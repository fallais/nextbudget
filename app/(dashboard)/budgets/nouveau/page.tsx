import { listAllCategories } from "@application/queries";
import { getBudgetStatuses, getCategoriesWithFixedExpenseCount } from "@application/budgets";
import { NewBudgetForm } from "@/components/budgets/new-budget-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewBudgetPage() {
  const [categories, statuses, fxByCategory] = await Promise.all([
    listAllCategories(),
    getBudgetStatuses(),
    getCategoriesWithFixedExpenseCount(),
  ]);

  const budgeted = new Set(statuses.map((s) => s.category.id));

  return (
    <NewBudgetForm
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        // A category already covered by a fixed expense is deliberately not
        // offered a budget: the same spending would be counted twice.
        unavailable: budgeted.has(c.id)
          ? "déjà un budget"
          : fxByCategory.has(c.id)
            ? "charge fixe"
            : null,
      }))}
    />
  );
}
