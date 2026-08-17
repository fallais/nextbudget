import "server-only";
import { Brackets, type SelectQueryBuilder } from "typeorm";
import { getDataSource } from "@infrastructure/db/client";
import { TransactionEntity, CategoryEntity, AccountEntity } from "@infrastructure/db/schemas";
import type { TransactionRow, CategoryRow, AccountRow } from "@domain/entities";
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
): Promise<{ rows: ListedTransaction[]; total: number }> {
  const ds = await getDataSource();
  const qb = ds.getRepository(TransactionEntity).createQueryBuilder("t");
  applyFilters(qb, filters);
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  const total = await qb.getCount();
  const txs = await qb
    .orderBy("t.date", "DESC")
    .addOrderBy("t.id", "DESC")
    .take(pagination.pageSize)
    .skip((pagination.page - 1) * pagination.pageSize)
    .getMany();
  return { rows: await attachRefs(txs), total };
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
