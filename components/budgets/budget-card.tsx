"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/categories/category-badge";
import { BudgetForm } from "./budget-form";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/schema";
import type { CategoryBudgetStatus } from "@/lib/db/budgets";

export function BudgetCard({
  status,
  fixedExpenseInfo,
}: {
  status: CategoryBudgetStatus;
  fixedExpenseInfo?: { count: number; expectedTotalCents: number };
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, Math.round(status.ratio * 100));
  const overshoot = status.ratio > 1;
  const danger = status.ratio >= 1;
  const warn = status.ratio >= 0.8 && status.ratio < 1;
  const barColor = danger
    ? "bg-rose-600"
    : warn
      ? "bg-amber-500"
      : "bg-emerald-600";

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CategoryBadge category={status.category} size="md" />
              <p className="text-xs text-muted-foreground">
                {formatCents(status.budgetCents)} / {status.periodLabel}
                {" · "}
                {status.daysRemaining} j restant
                {status.daysRemaining > 1 ? "s" : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setOpen(true)}
              aria-label="Modifier le budget"
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">
                {formatCents(status.spentCents)}
              </span>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  overshoot ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                )}
              >
                {overshoot
                  ? `dépassement ${formatCents(-status.remainingCents)}`
                  : `reste ${formatCents(status.remainingCents)}`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">{pct} %</span>
              {status.projectedCents !== null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <TrendingUp className="size-3" />à ce rythme : {formatCents(status.projectedCents)}
                </span>
              )}
            </div>
          </div>

          {fixedExpenseInfo && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Cette catégorie est aussi couverte par {fixedExpenseInfo.count} frais
                fixe{fixedExpenseInfo.count > 1 ? "s" : ""} (~
                {formatCents(fixedExpenseInfo.expectedTotalCents)}/mois). Risque de
                double-compte dans le Reste à vivre.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <BudgetForm open={open} onOpenChange={setOpen} category={status.category} />
    </>
  );
}

export function CategoryWithoutBudget({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-5">
          <CategoryBadge category={category} size="md" />
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Définir un budget
          </Button>
        </CardContent>
      </Card>
      <BudgetForm open={open} onOpenChange={setOpen} category={category} />
    </>
  );
}

export function CategoryCoveredByFixed({
  category,
  info,
}: {
  category: Category;
  info: { count: number; expectedTotalCents: number };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex items-center justify-between gap-2 p-4">
          <div className="space-y-0.5">
            <CategoryBadge category={category} />
            <p className="text-xs text-muted-foreground">
              {info.count} frais fixe{info.count > 1 ? "s" : ""} ·{" "}
              {formatCents(info.expectedTotalCents)}/mois
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/frais-fixes"
              className="text-xs text-primary hover:underline"
            >
              Gérer →
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Ajouter un budget quand même
            </button>
          </div>
        </CardContent>
      </Card>
      <BudgetForm open={open} onOpenChange={setOpen} category={category} />
    </>
  );
}
