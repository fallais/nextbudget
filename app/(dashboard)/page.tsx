import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  getBalanceEvolution,
  getCategoryBreakdown,
  getPeriodSummary,
} from "@application/stats";
import { listRecentTransactions } from "@application/queries";
import { getBudgetStatuses } from "@application/budgets";
import {
  getFixedExpensesWithStatus,
  summarizeFixedExpenses,
} from "@application/fixed-expenses";
import {
  computeActualNetCashflow,
  computeResteAVivre,
} from "@application/reste-a-vivre";
import { getContributionsByPersonWithStatus } from "@application/contributions";
import { PERIOD_LABELS, isPeriodKey, type PeriodKey } from "@domain/value-objects/period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Fetches; renders nothing itself.
 *
 * Ant Design ships no RSC directives, so its components throw when rendered
 * from a Server Component. Keeping the split at this line means the queries
 * still run on the server in one `Promise.all`, and only the finished rows
 * cross to the client.
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period: PeriodKey = isPeriodKey(raw) ? raw : "month";

  const [
    summary,
    balance,
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
    getCategoryBreakdown(period),
    listRecentTransactions(8),
    getBudgetStatuses(),
    getFixedExpensesWithStatus(),
    computeResteAVivre(),
    getContributionsByPersonWithStatus(),
    computeActualNetCashflow(),
  ]);

  return (
    <DashboardView
      summary={summary}
      balance={balance}
      breakdown={breakdown}
      recent={recent}
      budgetStatuses={budgetStatuses}
      fxStatuses={fxStatuses}
      fxSummary={summarizeFixedExpenses(fxStatuses)}
      resteAVivre={resteAVivre}
      perPerson={perPerson}
      soldeNet={soldeNet}
      periodLabel={PERIOD_LABELS[period].toLowerCase()}
    />
  );
}
