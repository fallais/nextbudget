import "server-only";
import { startOfMonth, endOfMonth, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { FixedExpenseEntity, CategoryEntity, TransactionEntity } from "@infrastructure/persistence/schemas";
import type { FixedExpenseRow, CategoryRow, TransactionRow } from "@domain/entities";
import { compileRule } from "@domain/services/categorization";
import { getScope, visibleAccountIds, applyAccountScope, applyOwnedScope } from "@application/scope";

export type FixedExpenseStatus = {
  fixedExpense: FixedExpenseRow;
  category: CategoryRow | null;
  matched: Pick<TransactionRow, "id" | "date" | "description" | "amountCents">[];
  paidAmountCents: number;
  state: "paid" | "pending" | "overdue" | "anomaly";
  variancePct: number | null;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export async function getFixedExpensesWithStatus(
  now: Date = new Date(),
): Promise<FixedExpenseStatus[]> {
  const start = isoDate(startOfMonth(now));
  const end = isoDate(endOfMonth(now));

  const ds = await getDataSource();
  const scope = await getScope();
  const fxQb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(fxQb, "f", scope);
  const fxList = await fxQb.getMany();
  if (fxList.length === 0) return [];

  const cats = await ds.getRepository(CategoryEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const monthlyQb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :start", { start })
    .andWhere("t.date <= :end", { end });
  applyAccountScope(monthlyQb, "t", await visibleAccountIds(scope));
  const monthly = (await monthlyQb.getMany()).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    normalized: t.normalizedDescription,
    amountCents: t.amountCents,
  }));

  const today = now.getDate();
  const out: FixedExpenseStatus[] = [];
  for (const fx of fxList) {
    const cat = fx.categoryId != null ? catMap.get(fx.categoryId) ?? null : null;
    if (!fx.isActive) {
      out.push({
        fixedExpense: fx,
        category: cat,
        matched: [],
        paidAmountCents: 0,
        state: "pending",
        variancePct: null,
      });
      continue;
    }
    const compiled = compileRule({
      id: 0,
      categoryId: 0,
      pattern: fx.matchPattern,
      matchType: fx.matchType,
      amountCondition: "negative",
      priority: 0,
    });
    if (!compiled) {
      out.push({
        fixedExpense: fx,
        category: cat,
        matched: [],
        paidAmountCents: 0,
        state: "pending",
        variancePct: null,
      });
      continue;
    }
    const matched = monthly
      .filter((t) => compiled.test(t.normalized, t.amountCents))
      .map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amountCents: t.amountCents,
      }));
    const paid = matched.reduce((a, t) => a + Math.abs(t.amountCents), 0);
    const expected = fx.expectedAmountCents;
    const variance = paid === 0 ? null : (paid - expected) / expected;

    let state: FixedExpenseStatus["state"];
    if (matched.length === 0) {
      const due = fx.dueDay;
      state = due !== null && today > due + 5 ? "overdue" : "pending";
    } else if (variance !== null && Math.abs(variance) * 100 > fx.tolerancePct) {
      state = "anomaly";
    } else {
      state = "paid";
    }

    out.push({
      fixedExpense: fx,
      category: cat,
      matched,
      paidAmountCents: paid,
      state,
      variancePct: variance === null ? null : variance * 100,
    });
  }
  return out;
}

export type FixedExpensesSummary = {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  anomaly: number;
  expectedTotalCents: number;
  paidTotalCents: number;
};

export function summarizeFixedExpenses(
  statuses: FixedExpenseStatus[],
): FixedExpensesSummary {
  const summary: FixedExpensesSummary = {
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    anomaly: 0,
    expectedTotalCents: 0,
    paidTotalCents: 0,
  };
  for (const s of statuses) {
    if (!s.fixedExpense.isActive) continue;
    summary.total++;
    summary[s.state]++;
    summary.expectedTotalCents += s.fixedExpense.expectedAmountCents;
    summary.paidTotalCents += s.paidAmountCents;
  }
  return summary;
}

/**
 * Fixed expenses visible to the current scope, in the order the UI shows them:
 * by due day, then name. A no-op filter in open mode.
 */
export async function listFixedExpenses(): Promise<FixedExpenseRow[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(qb, "f", await getScope());
  return qb.getMany();
}
