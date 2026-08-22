import "server-only";
import { Brackets, type SelectQueryBuilder } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { TransactionEntity, CategoryEntity, AccountEntity, ImportEntity } from "@infrastructure/persistence/schemas";
import type { TransactionRow, CategoryRow, AccountRow, ImportRow } from "@domain/entities";
import {
  getScope,
  visibleAccountIds,
  applyAccountScope,
  applyOwnedScope,
} from "@application/scope";

export type TransactionFilters = {
  from?: string | null;
  to?: string | null;
  categoryIds?: number[];
  accountIds?: number[];
  uncategorized?: boolean;
  search?: string;
  amountMin?: number;
  amountMax?: number;
};

export type ListedTransaction = TransactionRow & {
  category: CategoryRow | null;
  account: AccountRow | null;
};

/** What the filtered set adds up to — the page shows sums, not just rows. */
export type TransactionTotals = {
  inCents: number;
  outCents: number;
  netCents: number;
};

export type AccountBalance = {
  accountId: number;
  name: string;
  /** Movements since the opening balance was taken. Always known. */
  netCents: number;
  /**
   * What is in the account. Null until an opening balance is recorded: the
   * net of an import that starts in May is not a balance, and showing it as
   * one would be a number that quietly disagrees with the bank.
   */
  balanceCents: number | null;
};

function applyFilters(
  qb: SelectQueryBuilder<TransactionRow>,
  filters: TransactionFilters,
): SelectQueryBuilder<TransactionRow> {
  if (filters.from) qb.andWhere("t.date >= :from", { from: filters.from });
  if (filters.to) qb.andWhere("t.date <= :to", { to: filters.to });
  if (filters.uncategorized) {
    qb.andWhere("t.category_id IS NULL");
  } else if (filters.categoryIds && filters.categoryIds.length > 0) {
    qb.andWhere("t.category_id IN (:...categoryIds)", { categoryIds: filters.categoryIds });
  }
  if (filters.accountIds && filters.accountIds.length > 0) {
    qb.andWhere("t.account_id IN (:...accountIds)", { accountIds: filters.accountIds });
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    qb.andWhere(
      new Brackets((b) => {
        b.where("t.normalized_description ILIKE :s", { s }).orWhere(
          "t.description ILIKE :s",
          { s },
        );
      }),
    );
  }
  if (typeof filters.amountMin === "number") {
    qb.andWhere("t.amount_cents >= :amin", { amin: filters.amountMin });
  }
  if (typeof filters.amountMax === "number") {
    qb.andWhere("t.amount_cents <= :amax", { amax: filters.amountMax });
  }
  return qb;
}

async function attachRefs(txs: TransactionRow[]): Promise<ListedTransaction[]> {
  if (txs.length === 0) return [];
  const ds = await getDataSource();
  const cats = await ds.getRepository(CategoryEntity).find();
  const accs = await ds.getRepository(AccountEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const accMap = new Map(accs.map((a) => [a.id, a]));
  return txs.map((t) => ({
    ...t,
    category: t.categoryId != null ? catMap.get(t.categoryId) ?? null : null,
    account: accMap.get(t.accountId) ?? null,
  }));
}

export async function listTransactions(
  filters: TransactionFilters,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 50 },
): Promise<{ rows: ListedTransaction[]; total: number; totals: TransactionTotals }> {
  const ds = await getDataSource();
  const visible = await visibleAccountIds(await getScope());

  const qb = ds.getRepository(TransactionEntity).createQueryBuilder("t");
  applyFilters(qb, filters);
  applyAccountScope(qb, "t", visible);
  const total = await qb.getCount();
  const txs = await qb
    .orderBy("t.date", "DESC")
    .addOrderBy("t.id", "DESC")
    .take(pagination.pageSize)
    .skip((pagination.page - 1) * pagination.pageSize)
    .getMany();

  // The sums are over everything the filter matches, not the page: a total
  // that changed as you paged would answer a question nobody asked.
  const totalsQb = ds.getRepository(TransactionEntity).createQueryBuilder("t");
  applyFilters(totalsQb, filters);
  applyAccountScope(totalsQb, "t", visible);
  const sums = await totalsQb
    .select("COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0)", "in")
    .addSelect("COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN t.amount_cents ELSE 0 END), 0)", "out")
    .addSelect("COALESCE(SUM(t.amount_cents), 0)", "net")
    .getRawOne<{ in: string; out: string; net: string }>();

  return {
    rows: await attachRefs(txs),
    total,
    totals: {
      inCents: Number(sums?.in ?? 0),
      outCents: Number(sums?.out ?? 0),
      netCents: Number(sums?.net ?? 0),
    },
  };
}

/**
 * What is in each account, for the accounts asked for (all visible ones when
 * none are named).
 *
 * Transactions dated before the opening balance are already inside it, so
 * only what came after is added — otherwise re-importing an older statement
 * would move a balance that has not changed.
 */
export async function getAccountBalances(accountIds?: number[]): Promise<AccountBalance[]> {
  const all = await listAllAccounts();
  const wanted =
    accountIds && accountIds.length > 0 ? all.filter((a) => accountIds.includes(a.id)) : all;
  if (wanted.length === 0) return [];

  const ds = await getDataSource();
  const rows = await ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .innerJoin("accounts", "a", "a.id = t.account_id")
    .select("t.account_id", "accountId")
    .addSelect("COALESCE(SUM(t.amount_cents), 0)", "net")
    .where("t.account_id IN (:...ids)", { ids: wanted.map((a) => a.id) })
    .andWhere("(a.opening_balance_date IS NULL OR t.date >= a.opening_balance_date)")
    .groupBy("t.account_id")
    .getRawMany<{ accountId: number; net: string }>();

  const netById = new Map(rows.map((r) => [Number(r.accountId), Number(r.net)]));
  return wanted.map((a) => {
    const netCents = netById.get(a.id) ?? 0;
    return {
      accountId: a.id,
      name: a.name,
      netCents,
      balanceCents: a.openingBalanceCents != null ? a.openingBalanceCents + netCents : null,
    };
  });
}

export async function listAllCategories(): Promise<CategoryRow[]> {
  const ds = await getDataSource();
  return ds.getRepository(CategoryEntity).find({ order: { name: "ASC" } });
}

export async function listAllAccounts(): Promise<AccountRow[]> {
  const ds = await getDataSource();
  const qb = ds.getRepository(AccountEntity).createQueryBuilder("a").orderBy("a.name", "ASC");
  applyOwnedScope(qb, "a", await getScope());
  return qb.getMany();
}

export async function listRecentTransactions(limit = 10): Promise<ListedTransaction[]> {
  const ds = await getDataSource();
  const qb = ds.getRepository(TransactionEntity).createQueryBuilder("t");
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  const txs = await qb
    .orderBy("t.date", "DESC")
    .addOrderBy("t.id", "DESC")
    .take(limit)
    .getMany();
  return attachRefs(txs);
}

/**
 * Import runs, newest first — the history shown on the Import page.
 *
 * Imports have no domain class (nothing enforces an invariant on a log row),
 * so there is no repository for them and the read stays here.
 */
export async function listRecentImports(limit = 50): Promise<ImportRow[]> {
  const ds = await getDataSource();
  return ds.getRepository(ImportEntity).find({ order: { startedAt: "DESC" }, take: limit });
}
