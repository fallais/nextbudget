import { describe, it, expect } from "vitest";
import { detectTransfers, linkTransfer, unlinkTransfer, type TransferDeps } from "./transfers";
import { Transaction, type TransactionRow } from "@domain/entities";
import type { TransferLeg } from "@domain/services/transfers";

const base: TransactionRow = {
  id: 1,
  accountId: 1,
  categoryId: null,
  date: "2026-03-05",
  description: "VIREMENT LIVRET",
  normalizedDescription: "virement livret",
  amountCents: -50_000,
  currency: "EUR",
  hash: "h1",
  sourceFile: null,
  raw: null,
  transferGroupId: null,
  createdAt: new Date("2026-03-05T00:00:00Z"),
};

function row(over: Partial<TransactionRow>): TransactionRow {
  return { ...base, ...over };
}

/** Records what was written, so a test can assert on the wiring, not the SQL. */
function deps(
  stored: TransactionRow[],
  legs: TransferLeg[] = [],
): TransferDeps & { writes: { ids: number[]; groupId: string | null }[] } {
  const writes: { ids: number[]; groupId: string | null }[] = [];
  let n = 0;
  return {
    writes,
    newGroupId: () => `g${++n}`,
    transactions: {
      findById: async (id) => {
        const found = stored.find((t) => t.id === id);
        return found ? Transaction.reconstitute(found) : null;
      },
      findUnlinkedLegs: async () => legs,
      findByTransferGroup: async (groupId) => stored.filter((t) => t.transferGroupId === groupId),
      setTransferGroup: async (ids, groupId) => {
        writes.push({ ids, groupId });
        return ids.length;
      },
    },
  };
}

describe("declaring a transfer", () => {
  it("puts both legs under one identifier", async () => {
    const d = deps([row({ id: 1 }), row({ id: 2, accountId: 2, amountCents: 50_000 })]);
    const result = await linkTransfer([1, 2], d);
    expect(result).toEqual({ ok: true, groupId: "g1", legs: 2 });
    expect(d.writes).toEqual([{ ids: [1, 2], groupId: "g1" }]);
  });

  it("accepts a lone leg, the other account not being tracked here", async () => {
    const d = deps([row({ id: 1 })]);
    expect(await linkTransfer([1], d)).toMatchObject({ ok: true, legs: 1 });
  });

  it("writes nothing when one of the lines does not exist", async () => {
    const d = deps([row({ id: 1 })]);
    expect(await linkTransfer([1, 99], d)).toEqual({ ok: false, reason: "not_found" });
    expect(d.writes).toEqual([]);
  });

  it("refuses a line already claimed by another transfer", async () => {
    const d = deps([row({ id: 1, transferGroupId: "old" }), row({ id: 2, accountId: 2 })]);
    expect(await linkTransfer([1, 2], d)).toEqual({ ok: false, reason: "already_linked" });
    expect(d.writes).toEqual([]);
  });

  it("ignores a line named twice rather than calling it two legs", async () => {
    // Two ids, one account, one row: without the dedup this reads as a move
    // that never leaves the account and is refused for the wrong reason.
    const d = deps([row({ id: 1 })]);
    expect(await linkTransfer([1, 1], d)).toMatchObject({ ok: true, legs: 1 });
  });
});

describe("undoing a transfer", () => {
  it("detaches every leg it finds", async () => {
    const d = deps([
      row({ id: 1, transferGroupId: "g" }),
      row({ id: 2, transferGroupId: "g" }),
      row({ id: 3 }),
    ]);
    expect(await unlinkTransfer("g", d)).toBe(true);
    expect(d.writes).toEqual([{ ids: [1, 2], groupId: null }]);
  });

  it("reports a transfer that is not there", async () => {
    const d = deps([row({ id: 1 })]);
    expect(await unlinkTransfer("nope", d)).toBe(false);
    expect(d.writes).toEqual([]);
  });
});

describe("detecting transfers", () => {
  it("gives every pair its own identifier, so undoing one leaves the rest", async () => {
    const d = deps(
      [],
      [
        { id: 1, accountId: 1, date: "2026-03-05", amountCents: -50_000 },
        { id: 2, accountId: 2, date: "2026-03-05", amountCents: 50_000 },
        { id: 3, accountId: 1, date: "2026-03-20", amountCents: -20_000 },
        { id: 4, accountId: 2, date: "2026-03-21", amountCents: 20_000 },
      ],
    );
    expect(await detectTransfers(null, d)).toEqual({ pairs: 2, legs: 4 });
    expect(d.writes).toEqual([
      { ids: [1, 2], groupId: "g1" },
      { ids: [3, 4], groupId: "g2" },
    ]);
  });

  it("writes nothing when there is nothing to pair", async () => {
    const d = deps([], [{ id: 1, accountId: 1, date: "2026-03-05", amountCents: -50_000 }]);
    expect(await detectTransfers(null, d)).toEqual({ pairs: 0, legs: 0 });
    expect(d.writes).toEqual([]);
  });

  it("looks a few days either side of the statement it was handed", async () => {
    // The counterpart of a leg on the first day of the file may have been
    // imported with the previous month's statement.
    let asked: { from: string | null | undefined; to: string | null | undefined } = {
      from: undefined,
      to: undefined,
    };
    const d = deps([]);
    d.transactions.findUnlinkedLegs = async (from, to) => {
      asked = { from, to };
      return [];
    };
    await detectTransfers({ from: "2026-03-01", to: "2026-03-31" }, d);
    expect(asked).toEqual({ from: "2026-02-25", to: "2026-04-04" });
  });
});
