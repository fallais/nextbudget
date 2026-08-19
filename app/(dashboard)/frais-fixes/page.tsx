import {
  getFixedExpensesWithStatus,
  summarizeFixedExpenses,
} from "@application/fixed-expenses";
import { FixedExpensesView } from "@/components/fixed-expenses/fixed-expenses-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FraisFixesPage() {
  const statuses = await getFixedExpensesWithStatus();

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <FixedExpensesView
      statuses={statuses}
      summary={summarizeFixedExpenses(statuses)}
      monthElapsedPct={Math.round((now.getDate() / daysInMonth) * 100)}
    />
  );
}
