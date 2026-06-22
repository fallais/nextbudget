import "server-only";
import { IsNull, Not } from "typeorm";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, formatISO } from "date-fns";
import { getDataSource } from "./client";
import { CategoryEntity, TransactionEntity, FixedExpenseEntity, type Category } from "./entities";

export type CategoryBudgetStatus = {
  category: Category;
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

export async function getBudgetStatuses(now: Date = new Date()): Promise<CategoryBudgetStatus[]> {
  const ds = await getDataSource();
  const cats = await ds.getRepository(CategoryEntity).find({
    where: { budgetAmountCents: Not(IsNull()), budgetPeriod: Not(IsNull()) },
  });
  if (cats.length === 0) return [];

  const txRepo = ds.getRepository(TransactionEntity);
  const out: CategoryBudgetStatus[] = [];
  for (const cat of cats) {
    if (cat.budgetAmountCents === null || cat.budgetPeriod === null) continue;
    const isWeekly = cat.budgetPeriod === "weekly";
    const startD = isWeekly ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
    const endD = isWeekly ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
    const start = isoDate(startD);
    const end = isoDate(endD);

    const row = await txRepo
      .createQueryBuilder("t")
      .select("COALESCE(SUM(t.amount_cents), 0)", "sum")
      .where("t.category_id = :cid", { cid: cat.id })
      .andWhere("t.date >= :start", { start })
      .andWhere("t.date <= :end", { end })
      .andWhere("t.amount_cents < 0")
      .getRawOne<{ sum: string }>();
    const spent = Math.abs(Number(row?.sum ?? 0));

    const daysTotal = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1;
    const elapsed = Math.max(
      1,
      Math.min(daysTotal, Math.floor((now.getTime() - startD.getTime()) / 86_400_000) + 1),
    );
    const daysRemaining = Math.max(0, daysTotal - elapsed);
    const projected = elapsed > 0 ? Math.round((spent / elapsed) * daysTotal) : null;

    out.push({
      category: cat,
      periodLabel: isWeekly ? "semaine" : "mois",
      periodStart: start,
      periodEnd: end,
      budgetCents: cat.budgetAmountCents,
      spentCents: spent,
      remainingCents: cat.budgetAmountCents - spent,
      ratio: cat.budgetAmountCents === 0 ? 0 : spent / cat.budgetAmountCents,
      daysRemaining,
      daysTotal,
      projectedCents: projected,
    });
  }

  return out.sort((a, b) => b.ratio - a.ratio);
}

export async function getCategoriesWithFixedExpenseCount(): Promise<
  Map<number, { count: number; expectedTotalCents: number }>
> {
  const ds = await getDataSource();
  const rows = await ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .select("f.category_id", "categoryId")
    .addSelect("COUNT(*)", "count")
    .addSelect("COALESCE(SUM(f.expected_amount_cents), 0)", "total")
    .where("f.is_active = true")
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
