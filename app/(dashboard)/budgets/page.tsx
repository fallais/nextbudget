import { listAllCategories } from "@application/queries";
import {
  getBudgetStatuses,
  getCategoriesWithFixedExpenseCount,
} from "@application/budgets";
import { BudgetsView } from "@/components/budgets/budgets-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A weekly budget in a monthly summary is worth 52/12 of itself. */
const toMonthly = (cents: number, period: "weekly" | "monthly") =>
  period === "weekly" ? Math.round(cents * (52 / 12)) : cents;

export default async function BudgetsPage() {
  const [allCategories, statuses, fxByCategory] = await Promise.all([
    listAllCategories(),
    getBudgetStatuses(),
    getCategoriesWithFixedExpenseCount(),
  ]);

  const tracked = new Set(statuses.map((s) => s.category.id));
  const untracked = allCategories.filter((c) => !tracked.has(c.id));

  return (
    <BudgetsView
      statuses={statuses}
      // A category already covered by a fixed expense is deliberately not
      // offered a budget: the same spending would be counted twice.
      toBudget={untracked.filter((c) => !fxByCategory.has(c.id))}
      coveredByFixed={untracked.filter((c) => fxByCategory.has(c.id))}
      monthlyEquivalent={statuses.reduce((a, s) => a + toMonthly(s.budgetCents, s.period), 0)}
      monthlySpent={statuses.reduce((a, s) => a + toMonthly(s.spentCents, s.period), 0)}
    />
  );
}
