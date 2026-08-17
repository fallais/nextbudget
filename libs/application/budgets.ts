import "server-only";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/db/client";
import { BudgetEntity, CategoryEntity, TransactionEntity, FixedExpenseEntity } from "@infrastructure/db/schemas";
import type { Category } from "@domain/entities";
import { getScope, visibleAccountIds, applyAccountScope, applyOwnedScope } from "@application/scope";

export type CategoryBudgetStatus = {
  category: Category;
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

export async function getBudgetStatuses(now: Date = new Date()): Promise<CategoryBudgetStatus[]> {
  const ds = await getDataSource();
  const scope = await getScope();

  const bQb = ds.getRepository(BudgetEntity).createQueryBuilder("b");
  applyOwnedScope(bQb, "b", scope);
  const budgets = await bQb.getMany();
  if (budgets.length === 0) return [];

  const cats = await ds.getRepository(CategoryEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const accIds = await visibleAccountIds(scope);
  const txRepo = ds.getRepository(TransactionEntity);

  const out: CategoryBudgetStatus[] = [];
  for (const b of budgets) {
    const cat = catMap.get(b.categoryId);
    if (!cat) continue;
    const isWeekly = b.period === "weekly";
    const startD = isWeekly ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
    const endD = isWeekly ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
    const start = isoDate(startD);
    const end = isoDate(endD);

    const qb = txRepo
      .createQueryBuilder("t")
      .select("COALESCE(SUM(t.amount_cents), 0)", "sum")
      .where("t.category_id = :cid", { cid: b.categoryId })
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

    out.push({
      category: cat,
      period: b.period,
      periodLabel: isWeekly ? "semaine" : "mois",
      periodStart: start,
      periodEnd: end,
      budgetCents: b.amountCents,
      spentCents: spent,
      remainingCents: b.amountCents - spent,
      ratio: b.amountCents === 0 ? 0 : spent / b.amountCents,
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
