import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActualNetCashflow } from "@/lib/db/reste-a-vivre";

export function SoldeNetCard({ data }: { data: ActualNetCashflow }) {
  const negative = data.netCents < 0;
  const Icon = negative ? TrendingDown : TrendingUp;
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Solde net du mois (réel)
            </p>
            <p className="text-xs text-muted-foreground">
              transactions effectives en {data.monthLabel}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-md",
              negative
                ? "bg-rose-600/10 text-rose-600 dark:text-rose-400"
                : "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <Icon className="size-5" />
          </span>
        </div>

        <p
          className={cn(
            "text-4xl font-bold tabular-nums",
            negative
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {formatCents(data.netCents)}
        </p>

        <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Entrées</p>
            <p className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCents(data.entriesCents)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sorties</p>
            <p className="font-medium tabular-nums text-rose-600 dark:text-rose-400">
              {formatCents(data.exitsCents)}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {data.txCount} transaction{data.txCount > 1 ? "s" : ""} ce mois
        </p>
      </CardContent>
    </Card>
  );
}
