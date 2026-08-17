import { listAllCategories } from "@application/queries";
import {
  getFixedExpensesWithStatus,
  summarizeFixedExpenses,
} from "@application/fixed-expenses";
import {
  FixedExpensesTable,
  NewFixedExpenseButton,
} from "@/components/fixed-expenses/fixed-expenses-table";
import { formatCents } from "@shared/format";
import { Card, CardContent } from "@/components/ui/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FraisFixesPage() {
  const [statuses, allCategories] = await Promise.all([
    getFixedExpensesWithStatus(),
    listAllCategories(),
  ]);
  const summary = summarizeFixedExpenses(statuses);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Frais fixes</h2>
          <p className="text-sm text-muted-foreground">
            Suivez les dépenses récurrentes attendues chaque mois (loyer, énergie,
            abonnements…).
          </p>
        </div>
        <NewFixedExpenseButton categories={allCategories} />
      </div>

      {summary.total > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Suivis ce mois</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Payés / Attendus</p>
              <p className="text-2xl font-semibold tabular-nums">
                {summary.paid}
                <span className="text-base text-muted-foreground"> / {summary.total}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total attendu</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCents(summary.expectedTotalCents)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total débité</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCents(summary.paidTotalCents)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <FixedExpensesTable statuses={statuses} categories={allCategories} />
    </div>
  );
}
