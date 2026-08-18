import { Suspense } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { PeriodSelector } from "@/components/layout/period-selector";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { MonthlyBarChart } from "@/components/dashboard/monthly-bar-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import {
  getPeriodSummary,
  getBalanceEvolution,
  getStackedMonthlyExpenses,
  getCategoryBreakdown,
} from "@application/stats";
import { listRecentTransactions } from "@application/queries";
import { getBudgetStatuses } from "@application/budgets";
import {
  getFixedExpensesWithStatus,
  summarizeFixedExpenses,
} from "@application/fixed-expenses";
import {
  computeResteAVivre,
  computeActualNetCashflow,
} from "@application/reste-a-vivre";
import { getContributionsByPersonWithStatus } from "@application/contributions";
import { ResteAVivreCard } from "@/components/dashboard/reste-a-vivre-card";
import { SoldeNetCard } from "@/components/dashboard/solde-net-card";
import { BudgetsPanel } from "@/components/dashboard/budgets-panel";
import { FixedExpensesPanel } from "@/components/dashboard/fixed-expenses-panel";
import { ApportsPanel } from "@/components/dashboard/apports-panel";
import {
  PERIOD_LABELS,
  isPeriodKey,
  type PeriodKey,
} from "@domain/value-objects/period";
import { formatCents, formatPercent } from "@shared/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period: PeriodKey = isPeriodKey(raw) ? raw : "month";

  const [
    summary,
    balance,
    monthly,
    breakdown,
    recent,
    budgetStatuses,
    fxStatuses,
    resteAVivre,
    perPerson,
    soldeNet,
  ] = await Promise.all([
    getPeriodSummary(period),
    getBalanceEvolution(12),
    getStackedMonthlyExpenses(12, 5),
    getCategoryBreakdown(period),
    listRecentTransactions(10),
    getBudgetStatuses(),
    getFixedExpensesWithStatus(),
    computeResteAVivre(),
    getContributionsByPersonWithStatus(),
    computeActualNetCashflow(),
  ]);
  const fxSummary = summarizeFixedExpenses(fxStatuses);

  const periodLabel = PERIOD_LABELS[period].toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground">Vue d&apos;ensemble · {periodLabel}</p>
        </div>
        {/* This page is the only consumer of ?period — Transactions has its own
            Du/Au range in its filter panel — so the control lives here. */}
        <Suspense fallback={null}>
          <PeriodSelector />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ResteAVivreCard data={resteAVivre} />
        <SoldeNetCard data={soldeNet} />
      </div>
      <div className="grid grid-cols-1">
        <ApportsPanel perPerson={perPerson} />
      </div>
      {/* BudgetsPanel renders nothing when no budget is set, so the row drops
          to one column and the fixed-expenses panel takes the full width
          instead of leaving a hole. */}
      <div
        className={
          budgetStatuses.length > 0
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
            : "grid grid-cols-1 gap-4"
        }
      >
        <BudgetsPanel statuses={budgetStatuses} />
        <FixedExpensesPanel statuses={fxStatuses} summary={fxSummary} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Dépenses"
          value={formatCents(summary.totalExpensesCents)}
          icon={ArrowDownRight}
          accent="#dc2626"
          hint={`vs ${formatCents(summary.previousExpensesCents)} période précédente`}
          trend={
            summary.variationPercent === null
              ? undefined
              : {
                  value: formatPercent(summary.variationPercent),
                  positive: summary.variationPercent > 0,
                }
          }
        />
        <StatCard
          label="Recettes"
          value={formatCents(summary.totalIncomeCents)}
          icon={ArrowUpRight}
          accent="#16a34a"
        />
        <StatCard
          label="Top catégorie"
          value={summary.topCategory?.name ?? "—"}
          hint={
            summary.topCategory
              ? formatCents(summary.topCategory.totalCents)
              : "Aucune dépense catégorisée"
          }
          icon={Wallet}
          accent={summary.topCategory?.color ?? "#6366f1"}
        />
        <StatCard
          label="Non catégorisées"
          value={String(summary.uncategorizedCount)}
          icon={AlertTriangle}
          accent="#f59e0b"
          hint="à classer"
          href="/transactions?uncategorized=1"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solde cumulé · 12 mois</CardTitle>
            <CardDescription>Évolution mois par mois (toutes recettes - dépenses)</CardDescription>
          </CardHeader>
          <CardContent>
            <BalanceChart data={balance} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition · {periodLabel}</CardTitle>
            <CardDescription>Dépenses par catégorie</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={breakdown} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dépenses mensuelles · 12 mois</CardTitle>
          <CardDescription>Top 5 catégories empilées</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart data={monthly.data} series={monthly.series} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Dernières transactions</h3>
        <RecentTransactions rows={recent} />
      </div>
    </div>
  );
}
