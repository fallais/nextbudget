import "server-only";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  formatISO,
  format,
} from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { budgets } from "@infrastructure/persistence/repositories";
import { BudgetEntity, CategoryEntity, TransactionEntity, FixedExpenseEntity } from "@infrastructure/persistence/schemas";
import { invariant } from "@domain/errors";
import type { BudgetRepository } from "@domain/repositories";
import type { NewBudget } from "@domain/entities";
import type { BudgetRow, CategoryRow } from "@domain/entities";
import type { BudgetPeriod } from "@domain/enums";
import { getScope, visibleAccountIds, applyAccountScope, applyOwnedScope } from "@application/scope";

// Month bucket from an ISO 'yyyy-MM-dd' text date → 'yyyy-MM' (Postgres-portable).
const MONTH = "substr(t.date, 1, 7)";

export type CategoryBudgetStatus = {
  /** The budget's own id — what its page is addressed by. */
  id: number;
  category: CategoryRow;
  period: "weekly" | "monthly";
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  ratio: number;
  daysRemaining: number;
  daysTotal: number;
  projectedCents: number | null;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/**
 * What one budget looks like right now: spent against its ceiling, and how far
 * into the period that is.
 *
 * `accIds` is threaded in rather than resolved here so a list of budgets costs
 * one visibility lookup, not one per budget.
 */
async function statusOf(
  budget: BudgetRow,
  category: CategoryRow,
  accIds: number[] | null,
  now: Date,
): Promise<CategoryBudgetStatus> {
  const ds = await getDataSource();
  const isWeekly = budget.period === "weekly";
  const startD = isWeekly ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const endD = isWeekly ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
  const start = isoDate(startD);
  const end = isoDate(endD);

  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .select("COALESCE(SUM(t.amount_cents), 0)", "sum")
    .where("t.category_id = :cid", { cid: budget.categoryId })
    .andWhere("t.date >= :start", { start })
    .andWhere("t.date <= :end", { end })
    .andWhere("t.amount_cents < 0");
  applyAccountScope(qb, "t", accIds);
  const row = await qb.getRawOne<{ sum: string }>();
  const spent = Math.abs(Number(row?.sum ?? 0));

  const daysTotal = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1;
  const elapsed = Math.max(
    1,
    Math.min(daysTotal, Math.floor((now.getTime() - startD.getTime()) / 86_400_000) + 1),
  );
  const daysRemaining = Math.max(0, daysTotal - elapsed);
  const projected = elapsed > 0 ? Math.round((spent / elapsed) * daysTotal) : null;

  return {
    id: budget.id,
    category,
    period: budget.period,
    periodLabel: isWeekly ? "semaine" : "mois",
    periodStart: start,
    periodEnd: end,
    budgetCents: budget.amountCents,
    spentCents: spent,
    remainingCents: budget.amountCents - spent,
    ratio: budget.amountCents === 0 ? 0 : spent / budget.amountCents,
    daysRemaining,
    daysTotal,
    projectedCents: projected,
  };
}

export async function getBudgetStatuses(now: Date = new Date()): Promise<CategoryBudgetStatus[]> {
  const ds = await getDataSource();
  const scope = await getScope();

  const bQb = ds.getRepository(BudgetEntity).createQueryBuilder("b");
  applyOwnedScope(bQb, "b", scope);
  const rows = await bQb.getMany();
  if (rows.length === 0) return [];

  const cats = await ds.getRepository(CategoryEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const accIds = await visibleAccountIds(scope);

  const out: CategoryBudgetStatus[] = [];
  for (const b of rows) {
    const cat = catMap.get(b.categoryId);
    if (!cat) continue;
    out.push(await statusOf(b, cat, accIds, now));
  }

  return out.sort((a, b) => b.ratio - a.ratio);
}

/** One budget, by its own id — `null` when it does not exist or is out of scope. */
export async function getBudgetStatus(
  id: number,
  now: Date = new Date(),
): Promise<CategoryBudgetStatus | null> {
  const ds = await getDataSource();
  const scope = await getScope();

  const qb = ds.getRepository(BudgetEntity).createQueryBuilder("b").where("b.id = :id", { id });
  applyOwnedScope(qb, "b", scope);
  const budget = await qb.getOne();
  if (!budget) return null;

  const category = await ds.getRepository(CategoryEntity).findOne({
    where: { id: budget.categoryId },
  });
  if (!category) return null;

  return statusOf(budget, category, await visibleAccountIds(scope), now);
}

/**
 * A budget is one per category.
 *
 * The unique index alone would not say so — it allows the same category a
 * weekly *and* a monthly ceiling, which would silently double-count the same
 * spending. The rule is stated here, where creating one is the only way in.
 */
export async function createBudget(input: {
  categoryId: number;
  amountCents: number;
  period: BudgetPeriod;
  ownerId: number | null;
}): Promise<BudgetRow> {
  const existing = await budgets.findByCategory(input.categoryId);
  invariant(
    existing === null,
    "Cette catégorie a déjà un budget.",
    "budget.duplicate_category",
  );

  const created = await budgets.create({
    categoryId: input.categoryId,
    amountCents: input.amountCents,
    period: input.period,
    ownerId: input.ownerId,
    visibility: "shared",
  });
  return created.toRow();
}

export type MonthlySpend = { month: string; spentCents: number };

/**
 * What the category actually cost, month by month.
 *
 * Always monthly, even for a weekly budget: a ceiling is a habit, and the only
 * way to see whether the habit holds is to look further back than the period
 * you are inside. A weekly ceiling is compared against its monthly equivalent.
 * Months with no spending are returned as zero rather than omitted, so the bars
 * keep an even spacing.
 */
export async function getCategoryMonthlySpend(
  categoryId: number,
  months = 6,
  now: Date = new Date(),
): Promise<MonthlySpend[]> {
  const ds = await getDataSource();
  const from = startOfMonth(subMonths(now, months - 1));

  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .select(MONTH, "month")
    .addSelect("COALESCE(SUM(t.amount_cents), 0)", "sum")
    .where("t.category_id = :cid", { cid: categoryId })
    .andWhere("t.amount_cents < 0")
    .andWhere("t.date >= :from", { from: isoDate(from) })
    .andWhere("t.date <= :to", { to: isoDate(endOfMonth(now)) });
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  const rows = await qb.groupBy(MONTH).getRawMany<{ month: string; sum: string }>();

  const byMonth = new Map(rows.map((r) => [r.month, Math.abs(Number(r.sum))]));
  return Array.from({ length: months }, (_, i) => {
    const month = format(startOfMonth(subMonths(now, months - 1 - i)), "yyyy-MM");
    return { month, spentCents: byMonth.get(month) ?? 0 };
  });
}

export async function getCategoriesWithFixedExpenseCount(): Promise<
  Map<number, { count: number; expectedTotalCents: number }>
> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .select("f.category_id", "categoryId")
    .addSelect("COUNT(*)", "count")
    .addSelect("COALESCE(SUM(f.expected_amount_cents), 0)", "total")
    .where("f.is_active = true");
  applyOwnedScope(qb, "f", await getScope());
  const rows = await qb
    .groupBy("f.category_id")
    .getRawMany<{ categoryId: number | null; count: string; total: string }>();

  const map = new Map<number, { count: number; expectedTotalCents: number }>();
  for (const r of rows) {
    if (r.categoryId === null) continue;
    map.set(Number(r.categoryId), {
      count: Number(r.count),
      expectedTotalCents: Number(r.total),
    });
  }
  return map;
}

export type BudgetDeps = {
  budgets: Pick<BudgetRepository, "update" | "delete">;
};

const LIVE_BUDGET: BudgetDeps = { budgets };

/** Resolves `null` when no budget has that id. */
export async function updateBudget(
  budgetId: number,
  patch: Partial<NewBudget>,
  deps: BudgetDeps = LIVE_BUDGET,
): Promise<BudgetRow | null> {
  const updated = await deps.budgets.update(budgetId, patch);
  return updated?.toRow() ?? null;
}

/** Resolves `false` when there was nothing to delete. */
export async function deleteBudget(
  budgetId: number,
  deps: BudgetDeps = LIVE_BUDGET,
): Promise<boolean> {
  return deps.budgets.delete(budgetId);
}
