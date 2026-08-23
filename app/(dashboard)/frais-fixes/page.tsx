import {
  getFixedExpensesWithStatus,
  summarizeFixedExpenses,
} from "@application/fixed-expenses";
import { listDismissedKeys, listRecurringCharges } from "@application/recurring";
import { FixedExpensesView } from "@/components/fixed-expenses/fixed-expenses-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FraisFixesPage() {
  const [statuses, suggestions, dismissedKeys] = await Promise.all([
    getFixedExpensesWithStatus(),
    listRecurringCharges(),
    listDismissedKeys(),
  ]);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <FixedExpensesView
      statuses={statuses}
      summary={summarizeFixedExpenses(statuses)}
      monthElapsedPct={Math.round((now.getDate() / daysInMonth) * 100)}
      suggestions={suggestions}
      dismissedKeys={dismissedKeys}
    />
  );
}
