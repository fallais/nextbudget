import { getBudgetStatuses } from "@application/budgets";
import { monthlyEquivalentCents } from "@domain/entities";
import { BudgetsView } from "@/components/budgets/budgets-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const statuses = await getBudgetStatuses();

  // A weekly ceiling only compares with a monthly one once both are on the
  // same footing; the summary is stated per month because that is how the
  // rest of the app counts.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <BudgetsView
      statuses={statuses}
      monthlyBudgetCents={statuses.reduce(
        (sum, s) => sum + monthlyEquivalentCents(s.budgetCents, s.period),
        0,
      )}
      monthlySpentCents={statuses.reduce(
        (sum, s) => sum + monthlyEquivalentCents(s.spentCents, s.period),
        0,
      )}
      monthElapsedPct={Math.round((now.getDate() / daysInMonth) * 100)}
    />
  );
}
