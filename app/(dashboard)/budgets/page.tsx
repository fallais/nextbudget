import { listAllCategories } from "@/lib/db/queries";
import {
  getBudgetStatuses,
  getCategoriesWithFixedExpenseCount,
} from "@/lib/db/budgets";
import {
  BudgetCard,
  CategoryWithoutBudget,
  CategoryCoveredByFixed,
} from "@/components/budgets/budget-card";
import { formatCents } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const [allCategories, statuses, fxByCategory] = await Promise.all([
    listAllCategories(),
    getBudgetStatuses(),
    getCategoriesWithFixedExpenseCount(),
  ]);

  const tracked = new Set(statuses.map((s) => s.category.id));
  const untracked = allCategories.filter((c) => !tracked.has(c.id));
  const toBudget = untracked.filter((c) => !fxByCategory.has(c.id));
  const coveredByFixed = untracked.filter((c) => fxByCategory.has(c.id));

  // Monthly equivalent for the summary
  const monthlyEquivalent = statuses.reduce((acc, s) => {
    return (
      acc +
      (s.period === "weekly"
        ? Math.round(s.budgetCents * (52 / 12))
        : s.budgetCents)
    );
  }, 0);
  const monthlySpent = statuses.reduce((acc, s) => {
    return (
      acc +
      (s.period === "weekly"
        ? Math.round(s.spentCents * (52 / 12))
        : s.spentCents)
    );
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Budgets</h2>
          <p className="text-sm text-muted-foreground">
            Allouez un montant hebdomadaire ou mensuel pour les dépenses
            discrétionnaires (alimentation, loisirs, etc.). Les obligations
            récurrentes (loyer, énergie, assurances…) sont gérées dans{" "}
            <a href="/frais-fixes" className="text-primary hover:underline">
              Frais fixes
            </a>
            .
          </p>
        </div>
        {statuses.length > 0 && (
          <div className="rounded-md border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">Total alloué (équiv. mois) </span>
            <span className="font-semibold tabular-nums">
              {formatCents(monthlyEquivalent)}
            </span>
            <span className="text-muted-foreground"> · consommé </span>
            <span className="font-semibold tabular-nums">
              {formatCents(monthlySpent)}
            </span>
          </div>
        )}
      </div>

      {statuses.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun budget défini. Sélectionnez une catégorie ci-dessous pour commencer.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statuses.map((s) => (
            <BudgetCard
              key={s.category.id}
              status={s}
              fixedExpenseInfo={fxByCategory.get(s.category.id)}
            />
          ))}
        </div>
      )}

      {toBudget.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            À budgétiser ({toBudget.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {toBudget.map((c) => (
              <CategoryWithoutBudget key={c.id} category={c} />
            ))}
          </div>
        </div>
      )}

      {coveredByFixed.length > 0 && (
        <details className="space-y-3" >
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Couvertes par frais fixes ({coveredByFixed.length})
          </summary>
          <p className="text-xs text-muted-foreground">
            Ces catégories ont des frais fixes actifs ; en faire des budgets serait
            redondant. Cliquez « Ajouter un budget quand même » uniquement si vous
            avez aussi des dépenses discrétionnaires dans cette catégorie.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {coveredByFixed.map((c) => (
              <CategoryCoveredByFixed
                key={c.id}
                category={c}
                info={fxByCategory.get(c.id)!}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
