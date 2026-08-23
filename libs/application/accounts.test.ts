import { describe, it, expect } from "vitest";
import { createAccount, deleteAccount, updateAccount, type AccountDeps } from "./accounts";
import { Account, type AccountRow, type NewAccount } from "@domain/entities";

const stored: AccountRow = {
  id: 1,
  name: "Compte courant",
  kind: "joint",
  bank: null,
  iban: null,
  currency: "EUR",
  openingBalanceCents: null,
  openingBalanceDate: null,
  visibility: "shared",
  ownerId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const input = {
  name: "Livret A",
  kind: "personal",
  currency: "EUR",
  visibility: "shared",
} as unknown as Parameters<typeof createAccount>[0];

function deps(over: {
  found?: AccountRow | null;
  txCount?: number;
  me?: number | null;
  onCreate?: (input: NewAccount) => void;
  onDelete?: () => void;
} = {}): AccountDeps {
  const found = over.found === undefined ? stored : over.found;
  return {
    accounts: {
      findById: async () => (found ? Account.reconstitute(found) : null),
      create: async (i) => {
        over.onCreate?.(i);
        return Account.reconstitute({ ...stored, ...i } as AccountRow);
      },
      update: async (_id, patch) => Account.reconstitute({ ...stored, ...patch } as AccountRow),
      delete: async () => {
        over.onDelete?.();
        return true;
      },
    },
    transactions: { countByAccount: async () => over.txCount ?? 0 } as AccountDeps["transactions"],
    currentUserId: async () => (over.me === undefined ? 7 : over.me),
  };
}

describe("deleting an account", () => {
  it("is refused while it still holds transactions, and says how many", async () => {
    // There are no FK constraints, so nothing at the database layer would stop
    // this: the rows would simply be orphaned, still counted by every
    // aggregate but attached to an account that no longer exists.
    let deleted = false;
    const result = await deleteAccount(1, deps({ txCount: 12, onDelete: () => (deleted = true) }));
    expect(result).toEqual({ ok: false, reason: "has_transactions", count: 12 });
    expect(deleted).toBe(false);
  });

  it("goes ahead once it is empty", async () => {
    let deleted = false;
    const result = await deleteAccount(1, deps({ txCount: 0, onDelete: () => (deleted = true) }));
    expect(result).toEqual({ ok: true });
    expect(deleted).toBe(true);
  });

  it("reports an account that is not there", async () => {
    expect(await deleteAccount(404, deps({ found: null }))).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("creating an account", () => {
  it("belongs to whoever created it when no owner is named", async () => {
    let written: NewAccount | null = null;
    await createAccount(input, deps({ me: 7, onCreate: (i) => (written = i) }));
    expect(written!.ownerId).toBe(7);
  });

  it("lets an explicit owner win over the acting user", async () => {
    let written: NewAccount | null = null;
    await createAccount({ ...input, ownerId: 3 }, deps({ me: 7, onCreate: (i) => (written = i) }));
    expect(written!.ownerId).toBe(3);
  });

  it("is left unowned in open mode, where there is no acting user", async () => {
    let written: NewAccount | null = null;
    await createAccount(input, deps({ me: null, onCreate: (i) => (written = i) }));
    expect(written!.ownerId).toBeNull();
  });

  it("does not invent values the caller left out", async () => {
    let written: NewAccount | null = null;
    await createAccount(input, deps({ onCreate: (i) => (written = i) }));
    expect(written!.bank).toBeNull();
    expect(written!.iban).toBeNull();
    expect(written!.openingBalanceCents).toBeNull();
  });
});

describe("updating an account", () => {
  it("resolves null when there is no such account, rather than pretending", async () => {
    const d = deps();
    const missing: AccountDeps = { ...d, accounts: { ...d.accounts, update: async () => null } };
    expect(await updateAccount(404, { name: "x" }, missing)).toBeNull();
  });

  it("hands back a plain row, never the entity", async () => {
    const updated = await updateAccount(1, { name: "Renommé" }, deps());
    // The edge serialises this; an entity would arrive as {} over the wire.
    expect(updated).not.toHaveProperty("toRow");
    expect(updated?.name).toBe("Renommé");
  });
});
