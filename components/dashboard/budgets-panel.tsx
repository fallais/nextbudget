import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CategoryBadge } from "@/components/categories/category-badge";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryBudgetStatus } from "@/lib/db/budgets";

export function BudgetsPanel({ statuses }: { statuses: CategoryBudgetStatus[] }) {
  if (statuses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budgets du mois</CardTitle>
          <CardDescription>
            Aucun budget défini.{" "}
            <Link href="/budgets" className="text-primary hover:underline">
              En définir un →
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const top = statuses.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Budgets en cours</CardTitle>
          <CardDescription>Top {top.length} par taux de consommation</CardDescription>
        </div>
        <Link
          href="/budgets"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Tout voir <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {top.map((s) => {
          const pct = Math.min(100, Math.round(s.ratio * 100));
          const overshoot = s.ratio > 1;
          const danger = s.ratio >= 1;
          const warn = s.ratio >= 0.8 && s.ratio < 1;
          const barColor = danger
            ? "bg-rose-600"
            : warn
              ? "bg-amber-500"
              : "bg-emerald-600";
          return (
            <div key={s.category.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={s.category} />
                  <span className="text-xs text-muted-foreground">
                    /{s.periodLabel}
                  </span>
                </div>
                <span
                  className={cn(
                    "tabular-nums",
                    overshoot
                      ? "font-semibold text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground",
                  )}
                >
                  {formatCents(s.spentCents)} / {formatCents(s.budgetCents)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full transition-all", barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
