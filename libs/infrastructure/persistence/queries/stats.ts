import "server-only";
/**
 * Spending read models.
 *
 * These are queries, not use cases: they answer "what does the dashboard show"
 * and hand back a DTO shaped for a screen. There is no entity to rebuild and
 * no invariant to protect on the way out, which is why they live here rather
 * than behind a repository — a repository returns aggregates, and none of this
 * is one.
 *
 * `@application/stats` re-exports them, so the delivery layer still only ever
 * talks to the application.
 */
import type { SelectQueryBuilder } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { TransactionEntity } from "@infrastructure/persistence/schemas";
import type { TransactionRow } from "@domain/entities";
import { visibleAccountIds, applyAccountScope } from "./scope";
import { excludeTransfers } from "./transfers";
import { getScope } from "@application/scope";
import { periodToRange, previousPeriodRange, type PeriodKey } from "@domain/value-objects/period";

// Month bucket from an ISO 'yyyy-MM-dd' text date → 'yyyy-MM' (Postgres-portable).
const MONTH = "substr(t.date, 1, 7)";

export type PeriodSummary = {
  totalExpensesCents: number;
  totalIncomeCents: number;
  previousExpensesCents: number;
  variationPercent: number | null;
  topCategory: { id: number; name: string; color: string; icon: string; totalCents: number } | null;
  uncategorizedCount: number;
};

function withDates(
  qb: SelectQueryBuilder<TransactionRow>,
  from: string | null,
  to: string | null,
): SelectQueryBuilder<TransactionRow> {
  if (from) qb.andWhere("t.date >= :from", { from });
  if (to) qb.andWhere("t.date <= :to", { to });
  return qb;
}

export async function getPeriodSummary(period: PeriodKey): Promise<PeriodSummary> {
  const ds = await getDataSource();
  const txRepo = ds.getRepository(TransactionEntity);
  const accIds = await visibleAccountIds(await getScope());
  const { from, to } = periodToRange(period);

  const totals = await excludeTransfers(
    applyAccountScope(
      withDates(
        txRepo
          .createQueryBuilder("t")
          .select(
            "COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN t.amount_cents ELSE 0 END), 0)",
            "expenses",
          )
          .addSelect(
            "COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0)",
            "income",
          ),
        from,
        to,
      ),
      "t",
      accIds,
    ),
    "t",
  ).getRawOne<{ expenses: string; income: string }>();

  const totalExpensesCents = Math.abs(Number(totals?.expenses ?? 0));
  const totalIncomeCents = Number(totals?.income ?? 0);

  const prev = previousPeriodRange(period);
  const prevRow = await excludeTransfers(
    applyAccountScope(
      withDates(
        txRepo
          .createQueryBuilder("t")
          .select(
            "COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN t.amount_cents ELSE 0 END), 0)",
            "expenses",
          ),
        prev.from,
        prev.to,
      ),
      "t",
      accIds,
    ),
    "t",
  ).getRawOne<{ expenses: string }>();
  const previousExpensesCents = Math.abs(Number(prevRow?.expenses ?? 0));
  const variationPercent =
    previousExpensesCents === 0
      ? null
      : ((totalExpensesCents - previousExpensesCents) / previousExpensesCents) * 100;

  const topRow = await excludeTransfers(
    applyAccountScope(
      withDates(
        txRepo
          .createQueryBuilder("t")
          .innerJoin("categories", "c", "c.id = t.category_id")
          .select("c.id", "id")
          .addSelect("c.name", "name")
          .addSelect("c.color", "color")
          .addSelect("c.icon", "icon")
          .addSelect("COALESCE(SUM(t.amount_cents), 0)", "total")
          .andWhere("t.amount_cents < 0"),
        from,
        to,
      ),
      "t",
      accIds,
    ),
    "t",
  )
    .groupBy("c.id")
    .orderBy("SUM(t.amount_cents)", "ASC")
    .limit(1)
    .getRawOne<{ id: number; name: string; color: string; icon: string; total: string }>();

  const topCategory = topRow
    ? {
        id: Number(topRow.id),
        name: topRow.name,
        color: topRow.color,
        icon: topRow.icon,
        totalCents: Math.abs(Number(topRow.total)),
      }
    : null;

  const uncategorizedCount = await excludeTransfers(
    applyAccountScope(
      txRepo.createQueryBuilder("t").where("t.category_id IS NULL"),
      "t",
      accIds,
    ),
    "t",
  ).getCount();

  return {
    totalExpensesCents,
    totalIncomeCents,
    previousExpensesCents,
    variationPercent,
    topCategory,
    uncategorizedCount,
  };
}

export type MonthlyPoint = { month: string; income: number; expenses: number; net: number };

export async function getMonthlyTotals(months = 12): Promise<MonthlyPoint[]> {
  const ds = await getDataSource();
  const accIds = await visibleAccountIds(await getScope());
  const rows = await excludeTransfers(
    applyAccountScope(
      ds
        .getRepository(TransactionEntity)
        .createQueryBuilder("t")
        .select(MONTH, "month")
        .addSelect(
          "COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0)",
          "income",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN t.amount_cents ELSE 0 END), 0)",
          "expenses",
        ),
      "t",
      accIds,
    ),
    "t",
  )
    .groupBy(MONTH)
    .orderBy(MONTH, "DESC")
    .limit(months)
    .getRawMany<{ month: string; income: string; expenses: string }>();

  return rows
    .map((r) => ({
      month: r.month,
      income: Number(r.income),
      expenses: Math.abs(Number(r.expenses)),
      net: Number(r.income) + Number(r.expenses),
    }))
    .reverse();
}

export type BalancePoint = { month: string; balanceCents: number };

export async function getBalanceEvolution(months = 12): Promise<BalancePoint[]> {
  const ds = await getDataSource();
  const accIds = await visibleAccountIds(await getScope());
  const rows = await applyAccountScope(
    ds
      .getRepository(TransactionEntity)
      .createQueryBuilder("t")
      .select(MONTH, "month")
      .addSelect("COALESCE(SUM(t.amount_cents), 0)", "sum"),
    "t",
    accIds,
  )
    .groupBy(MONTH)
    .orderBy(MONTH, "ASC")
    .getRawMany<{ month: string; sum: string }>();

  let running = 0;
  const all = rows.map((r) => {
    running += Number(r.sum);
    return { month: r.month, balanceCents: running };
  });
  return all.slice(-months);
}

export type StackedMonthlyPoint = {
  month: string;
  [categoryName: string]: number | string;
};

export type CategorySeries = { name: string; color: string };

export async function getStackedMonthlyExpenses(
  months = 12,
  topN = 5,
): Promise<{ data: StackedMonthlyPoint[]; series: CategorySeries[] }> {
  const ds = await getDataSource();
  const txRepo = ds.getRepository(TransactionEntity);
  const accIds = await visibleAccountIds(await getScope());

  const topCats = await excludeTransfers(
    applyAccountScope(
      txRepo
        .createQueryBuilder("t")
        .innerJoin("categories", "c", "c.id = t.category_id")
        .select("c.id", "id")
        .addSelect("c.name", "name")
        .addSelect("c.color", "color")
        .addSelect("SUM(t.amount_cents)", "total")
        .where("t.amount_cents < 0"),
      "t",
      accIds,
    ),
    "t",
  )
    .groupBy("c.id")
    .orderBy("SUM(t.amount_cents)", "ASC")
    .limit(topN)
    .getRawMany<{ id: number; name: string; color: string; total: string }>();

  const topIds = new Set(topCats.map((c) => Number(c.id)));

  const rows = await excludeTransfers(
    applyAccountScope(
      txRepo
        .createQueryBuilder("t")
        .leftJoin("categories", "c", "c.id = t.category_id")
        .select(MONTH, "month")
        .addSelect("t.category_id", "categoryId")
        .addSelect("c.name", "categoryName")
        .addSelect("SUM(t.amount_cents)", "total")
        .where("t.amount_cents < 0"),
      "t",
      accIds,
    ),
    "t",
  )
    .groupBy(MONTH)
    .addGroupBy("t.category_id")
    .addGroupBy("c.name")
    .getRawMany<{ month: string; categoryId: number | null; categoryName: string | null; total: string }>();

  const byMonth = new Map<string, StackedMonthlyPoint>();
  for (const r of rows) {
    const month = r.month;
    if (!byMonth.has(month)) byMonth.set(month, { month });
    const point = byMonth.get(month)!;
    const cid = r.categoryId === null ? null : Number(r.categoryId);
    const seriesName =
      cid === null
        ? "Non catégorisée"
        : topIds.has(cid)
          ? r.categoryName ?? "Autre"
          : "Autre";
    const value = Math.abs(Number(r.total));
    point[seriesName] = (Number(point[seriesName] ?? 0) as number) + value;
  }

  const sortedMonths = [...byMonth.keys()].sort();
  const data = sortedMonths.slice(-months).map((m) => byMonth.get(m)!);

  const series: CategorySeries[] = [
    ...topCats.map((c) => ({ name: c.name, color: c.color })),
    { name: "Autre", color: "#94a3b8" },
    { name: "Non catégorisée", color: "#cbd5e1" },
  ];

  return { data, series };
}

export type CategoryBreakdownItem = {
  id: number | null;
  name: string;
  color: string;
  icon: string;
  totalCents: number;
};

export async function getCategoryBreakdown(period: PeriodKey): Promise<CategoryBreakdownItem[]> {
  const ds = await getDataSource();
  const accIds = await visibleAccountIds(await getScope());
  const { from, to } = periodToRange(period);

  const rows = await excludeTransfers(
    applyAccountScope(
      withDates(
        ds
          .getRepository(TransactionEntity)
          .createQueryBuilder("t")
          .leftJoin("categories", "c", "c.id = t.category_id")
          .select("t.category_id", "id")
          .addSelect("c.name", "name")
          .addSelect("c.color", "color")
          .addSelect("c.icon", "icon")
          .addSelect("SUM(t.amount_cents)", "total")
          .andWhere("t.amount_cents < 0"),
        from,
        to,
      ),
      "t",
      accIds,
    ),
    "t",
  )
    .groupBy("t.category_id")
    .addGroupBy("c.name")
    .addGroupBy("c.color")
    .addGroupBy("c.icon")
    .orderBy("SUM(t.amount_cents)", "ASC")
    .getRawMany<{ id: number | null; name: string | null; color: string | null; icon: string | null; total: string }>();

  return rows.map((r) => ({
    id: r.id === null ? null : Number(r.id),
    name: r.name ?? "Non catégorisée",
    color: r.color ?? "#94a3b8",
    icon: r.icon ?? "HelpCircle",
    totalCents: Math.abs(Number(r.total)),
  }));
}
