import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResteAVivre } from "@/lib/db/reste-a-vivre";

export function ResteAVivreCard({ data }: { data: ResteAVivre }) {
  const negative = data.resteAVivreCents < 0;
  const incomeLabel =
    data.mode === "contributions"
      ? "Apports prévus"
      : `Revenus moy. (${data.monthsAveraged} mois)`;
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Reste à vivre
            </p>
            <p className="text-xs text-muted-foreground">
              estimation pour {data.monthLabel}
              {data.mode === "history" && " · à partir de l'historique"}
            </p>
          </div>
          <span className="inline-flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </span>
        </div>

        <p
          className={cn(
            "text-4xl font-bold tabular-nums",
            negative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {formatCents(data.resteAVivreCents)}
        </p>

        <div className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{incomeLabel}</p>
            <p className="font-medium tabular-nums">
              {formatCents(data.monthlyIncomeCents)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">− Frais fixes</p>
            <p className="font-medium tabular-nums">
              {formatCents(data.fixedExpensesTotalCents)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">− Budgets alloués</p>
            <p className="font-medium tabular-nums">
              {formatCents(data.budgetsTotalMonthlyCents)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
