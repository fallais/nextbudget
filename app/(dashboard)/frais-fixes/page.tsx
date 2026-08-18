import { listAllCategories } from "@application/queries";
import {
  getFixedExpensesWithStatus,
  summarizeFixedExpenses,
} from "@application/fixed-expenses";
import { FixedExpensesView } from "@/components/fixed-expenses/fixed-expenses-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FraisFixesPage() {
  const [statuses, categories] = await Promise.all([
    getFixedExpensesWithStatus(),
    listAllCategories(),
  ]);

  return (
    <FixedExpensesView
      statuses={statuses}
      summary={summarizeFixedExpenses(statuses)}
      categories={categories}
    />
  );
}
