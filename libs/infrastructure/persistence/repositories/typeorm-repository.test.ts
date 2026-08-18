import { describe, expect, it } from "vitest";
import { Account, type AccountRow, type NewAccount } from "@domain/entities";
import { DomainError } from "@domain/errors";
import { TypeOrmRepository } from "./typeorm-repository";

/**
 * The point of the port is that this is testable with no database: a fake
 * standing in for TypeORM's `Repository` is enough to pin the behaviour that
 * matters, which is *when the domain factory runs*.
 */

function fakeTypeOrmRepo(rows: AccountRow[]) {
  return {
    rows,
    findOne: async ({ where }: { where: { id: number } }) =>
      rows.find((r) => r.id === where.id) ?? null,
    create: (values: Partial<AccountRow>) => ({ ...values }),
    save: async (draft: Partial<AccountRow>) => {
      const row = { ...draft, id: rows.length + 1, createdAt: new Date() } as AccountRow;
      rows.push(row);
      return row;
    },
    update: async (id: number, patch: Partial<AccountRow>) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    },
    delete: async (id: number) => {
      const before = rows.length;
      const index = rows.findIndex((r) => r.id === id);
      if (index >= 0) rows.splice(index, 1);
      return { affected: before - rows.length };
    },
    count: async () => rows.length,
  };
}

/** Swaps the DataSource lookup for the fake; everything else is the real class. */
class TestRepository extends TypeOrmRepository<Account, AccountRow, NewAccount> {
  constructor(private readonly fake: ReturnType<typeof fakeTypeOrmRepo>) {
    // The schema is never touched because `repo()` is overridden below.
    super(null as never, Account);
  }
  protected async repo() {
    return this.fake as never;
  }
}

const validInput: NewAccount = {
  name: "Compte courant",
  kind: "personal",
  bank: null,
  iban: null,
  currency: "EUR",
  ownerId: 1,
  visibility: "shared",
};

const storedRow = (overrides: Partial<AccountRow> = {}): AccountRow => ({
  id: 1,
  createdAt: new Date("2026-01-01"),
  ...validInput,
  ...overrides,
});

describe("TypeOrmRepository", () => {
  it("validates through the entity factory before inserting", async () => {
    const fake = fakeTypeOrmRepo([]);
    const repo = new TestRepository(fake);

    await expect(repo.create({ ...validInput, name: "   " })).rejects.toThrow(DomainError);
    expect(fake.rows).toHaveLength(0);
  });

  it("strips generated columns so Postgres owns id and createdAt", async () => {
    const fake = fakeTypeOrmRepo([]);
    const created = await new TestRepository(fake).create(validInput);

    expect(created.id).toBe(1);
    // Account.create() stamps id 0 on the candidate; the insert must not carry it.
    expect(fake.rows[0].id).toBe(1);
  });

  it("re-validates the merged row on update, not the patch alone", async () => {
    const fake = fakeTypeOrmRepo([storedRow()]);
    const repo = new TestRepository(fake);

    // `currency` must be a three-letter code. The patch is the only field sent,
    // so a repository that validated the patch in isolation would let it past.
    await expect(repo.update(1, { currency: "EUROS" })).rejects.toThrow(DomainError);
    expect(fake.rows[0].currency).toBe("EUR");
  });

  it("applies a valid update", async () => {
    const fake = fakeTypeOrmRepo([storedRow()]);
    const updated = await new TestRepository(fake).update(1, { name: "Compte joint" });

    expect(updated?.name).toBe("Compte joint");
  });

  it("resolves null when updating an id that does not exist", async () => {
    const repo = new TestRepository(fakeTypeOrmRepo([]));
    await expect(repo.update(404, { name: "Absent" })).resolves.toBeNull();
  });

  it("reports whether a delete removed anything", async () => {
    const repo = new TestRepository(fakeTypeOrmRepo([storedRow()]));
    await expect(repo.delete(1)).resolves.toBe(true);
    await expect(repo.delete(1)).resolves.toBe(false);
  });
});
