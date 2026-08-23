import "server-only";
import { startOfMonth, endOfMonth, subMonths, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { TransactionEntity, CategoryEntity, FixedExpenseEntity, ContributionEntity, BudgetEntity } from "@infrastructure/persistence/schemas";
import {visibleAccountIds, applyAccountScope, applyOwnedScope} from "./scope";
import { getScope } from "@application/scope";

export type ResteAVivreMode = "contributions" | "history";

export type ResteAVivre = {
  mode: ResteAVivreMode;
  monthlyIncomeCents: number;
  fixedExpensesTotalCents: number;
  budgetsTotalMonthlyCents: number;
  resteAVivreCents: number;
  monthLabel: string;
  monthsAveraged: number;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export async function computeResteAVivre(now: Date = new Date()): Promise<ResteAVivre> {
  const ds = await getDataSource();
  const scope = await getScope();
  const accIds = await visibleAccountIds(scope);

  // 1) Contributions mode
  const contribQb = ds
    .getRepository(ContributionEntity)
    .createQueryBuilder("c")
    .innerJoin("persons", "p", "p.id = c.person_id")
    .select("COALESCE(SUM(c.expected_amount_cents), 0)", "sum")
    .where("c.is_active = true")
    .andWhere("p.is_active = true");
  applyOwnedScope(contribQb, "c", scope);
  const contribRow = await contribQb.getRawOne<{ sum: string }>();
  const expectedContribTotal = Number(contribRow?.sum ?? 0);

  let monthlyIncome: number;
  let mode: ResteAVivreMode;
  const monthsAveraged = 3;
  if (expectedContribTotal > 0) {
    monthlyIncome = expectedContribTotal;
    mode = "contributions";
  } else {
    // 2) Fallback: 3-month historic average from the Apports category
    const revenusCat = await ds.getRepository(CategoryEntity).findOne({
      where: { name: "Apports" },
    });
    let avgIncome = 0;
    if (revenusCat) {
      const start = isoDate(startOfMonth(subMonths(now, 3)));
      const end = isoDate(endOfMonth(subMonths(now, 1)));
      const incomeQb = ds
        .getRepository(TransactionEntity)
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.amount_cents), 0)", "sum")
        .where("t.category_id = :cid", { cid: revenusCat.id })
        .andWhere("t.date >= :start", { start })
        .andWhere("t.date <= :end", { end })
        .andWhere("t.amount_cents > 0");
      applyAccountScope(incomeQb, "t", accIds);
      const row = await incomeQb.getRawOne<{ sum: string }>();
      avgIncome = Math.round(Number(row?.sum ?? 0) / monthsAveraged);
    }
    monthlyIncome = avgIncome;
    mode = "history";
  }

  const fxQb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .select("COALESCE(SUM(f.expected_amount_cents), 0)", "sum")
    .where("f.is_active = true");
  applyOwnedScope(fxQb, "f", scope);
  const fxRow = await fxQb.getRawOne<{ sum: string }>();
  const fixedTotal = Number(fxRow?.sum ?? 0);

  const budgetQb = ds
    .getRepository(BudgetEntity)
    .createQueryBuilder("b")
    .select(
      "COALESCE(SUM(CASE WHEN b.period = 'monthly' THEN b.amount_cents ELSE 0 END), 0)",
      "monthly",
    )
    .addSelect(
      "COALESCE(SUM(CASE WHEN b.period = 'weekly' THEN b.amount_cents ELSE 0 END), 0)",
      "weekly",
    );
  applyOwnedScope(budgetQb, "b", scope);
  const budgetRow = await budgetQb.getRawOne<{ monthly: string; weekly: string }>();
  const budgetMonthly = Number(budgetRow?.monthly ?? 0);
  const budgetWeekly = Number(budgetRow?.weekly ?? 0);
  const budgetsTotalMonthly = budgetMonthly + Math.round(budgetWeekly * (52 / 12));

  return {
    mode,
    monthlyIncomeCents: monthlyIncome,
    fixedExpensesTotalCents: fixedTotal,
    budgetsTotalMonthlyCents: budgetsTotalMonthly,
    resteAVivreCents: monthlyIncome - fixedTotal - budgetsTotalMonthly,
    monthLabel: now.toLocaleString("fr-FR", { month: "long", year: "numeric" }),
    monthsAveraged,
  };
}

export type ActualNetCashflow = {
  monthLabel: string;
  entriesCents: number;
  exitsCents: number;
  netCents: number;
  txCount: number;
};

export async function computeActualNetCashflow(
  now: Date = new Date(),
): Promise<ActualNetCashflow> {
  const ds = await getDataSource();
  const accIds = await visibleAccountIds(await getScope());
  const start = isoDate(startOfMonth(now));
  const end = isoDate(endOfMonth(now));
  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .select(
      "COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0)",
      "entries",
    )
    .addSelect(
      "COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN t.amount_cents ELSE 0 END), 0)",
      "exits",
    )
    .addSelect("COUNT(*)", "count")
    .where("t.date >= :start", { start })
    .andWhere("t.date <= :end", { end });
  applyAccountScope(qb, "t", accIds);
  const row = await qb.getRawOne<{ entries: string; exits: string; count: string }>();
  const entries = Number(row?.entries ?? 0);
  const exits = Number(row?.exits ?? 0);
  return {
    monthLabel: now.toLocaleString("fr-FR", { month: "long", year: "numeric" }),
    entriesCents: entries,
    exitsCents: exits,
    netCents: entries + exits,
    txCount: Number(row?.count ?? 0),
  };
}
