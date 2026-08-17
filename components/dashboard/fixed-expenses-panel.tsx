import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCents } from "@shared/format";
import { cn } from "@shared/utils";
import type { FixedExpenseStatus, FixedExpensesSummary } from "@application/fixed-expenses";

const STATE_META: Record<
  FixedExpenseStatus["state"],
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  paid: { label: "Payé", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  pending: { label: "Attendu", icon: Clock, cls: "text-muted-foreground" },
  overdue: { label: "En retard", icon: AlertCircle, cls: "text-amber-600 dark:text-amber-400" },
  anomaly: { label: "Écart", icon: AlertTriangle, cls: "text-rose-600 dark:text-rose-400" },
};

export function FixedExpensesPanel({
  statuses,
  summary,
}: {
  statuses: FixedExpenseStatus[];
  summary: FixedExpensesSummary;
}) {
  if (summary.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frais fixes du mois</CardTitle>
          <CardDescription>
            Aucun frais fixe configuré.{" "}
            <Link href="/frais-fixes" className="text-primary hover:underline">
              En ajouter →
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const active = statuses.filter((s) => s.fixedExpense.isActive);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Frais fixes du mois</CardTitle>
          <CardDescription>
            {summary.paid} payés / {summary.total} ·{" "}
            {formatCents(summary.paidTotalCents)} débité sur {formatCents(summary.expectedTotalCents)}
          </CardDescription>
        </div>
        <Link
          href="/frais-fixes"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Tout voir <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {active.slice(0, 6).map((s) => {
            const meta = STATE_META[s.state];
            const Icon = meta.icon;
            return (
              <li key={s.fixedExpense.id} className="flex items-center gap-3 py-2 text-sm">
                <Icon className={cn("size-4 shrink-0", meta.cls)} />
                <span className="flex-1 truncate">{s.fixedExpense.name}</span>
                {s.fixedExpense.dueDay && (
                  <span className="text-xs text-muted-foreground">j {s.fixedExpense.dueDay}</span>
                )}
                <span className="w-24 text-right tabular-nums">
                  {s.matched.length === 0 ? (
                    <span className="text-muted-foreground">
                      {formatCents(s.fixedExpense.expectedAmountCents)}
                    </span>
                  ) : (
                    <span className="font-medium">{formatCents(s.paidAmountCents)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
