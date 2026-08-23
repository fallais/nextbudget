"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Col, Flex, Row, Typography } from "antd";
import { PeriodSelector } from "@/components/layout/period-selector";
import { ResteAVivreCard } from "./reste-a-vivre-card";
import { ProjectionCard } from "./projection-card";
import { StatTiles } from "./stat-tiles";
import { CategoryDonut } from "./category-donut";
import { BalanceChart } from "./balance-chart";
import { BudgetsPanel } from "./budgets-panel";
import { FixedExpensesPanel } from "./fixed-expenses-panel";
import { ApportsPanel } from "./apports-panel";
import { RecentTransactions } from "./recent-transactions";
import type { BalancePoint, CategoryBreakdownItem, PeriodSummary } from "@application/stats";
import type { ListedTransaction } from "@application/queries";
import type { CategoryBudgetStatus } from "@application/budgets";
import type { FixedExpenseStatus, FixedExpensesSummary } from "@application/fixed-expenses";
import type { ActualNetCashflow, ResteAVivre } from "@application/reste-a-vivre";
import type { PersonWithStatus } from "@application/contributions";
import type { CashflowProjection } from "@application/projection";

const { Text } = Typography;

/**
 * The dashboard, ordered by the questions people actually open a budget app to
 * answer:
 *
 *   1. Can I spend?        → reste à vivre, with its arithmetic visible
 *   1b. Does it hold?      → the balance projected to the end of the month
 *   2. Am I on track?      → four compact figures for the period
 *   3. What is eating it?  → category split and the balance trend
 *   4. What is coming?     → budgets near their limit, charges still due
 *   5. What just happened? → the last movements
 *
 * Panels with nothing to say render nothing at all rather than an empty shell,
 * so a solo install with no budgets sees a short page instead of a wall of
 * placeholders.
 *
 * This is a Client Component and the page above it is not, on purpose: Ant
 * Design ships no RSC directives, so rendering `<Flex>` or `<Card>` straight
 * from a Server Component throws. The page fetches; this renders.
 */
export function DashboardView({
  summary,
  balance,
  breakdown,
  recent,
  budgetStatuses,
  fxStatuses,
  fxSummary,
  resteAVivre,
  projection,
  perPerson,
  soldeNet,
  periodLabel,
}: {
  summary: PeriodSummary;
  balance: BalancePoint[];
  breakdown: CategoryBreakdownItem[];
  recent: ListedTransaction[];
  budgetStatuses: CategoryBudgetStatus[];
  fxStatuses: FixedExpenseStatus[];
  fxSummary: FixedExpensesSummary;
  resteAVivre: ResteAVivre;
  projection: CashflowProjection;
  perPerson: PersonWithStatus[];
  soldeNet: ActualNetCashflow;
  periodLabel: string;
}) {
  const hasBudgets = budgetStatuses.length > 0;
  const hasApports = perPerson.some((p) => p.person.isActive && p.contributions.length > 0);

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Tableau de bord" }]}
        description={`Vue d'ensemble · ${periodLabel}`}
        actions={
          <Suspense fallback={null}>
            <PeriodSelector />
          </Suspense>
        }
      />

      {/* 1 — the headline */}
      <ResteAVivreCard data={resteAVivre} />

      {/* 1b — and does it hold to the end of the month */}
      <ProjectionCard projection={projection} />

      {/* 2 — the period at a glance */}
      <StatTiles summary={summary} soldeNet={soldeNet} periodLabel={periodLabel} />

      {/* 3 — where it went, and where it is heading */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <CategoryDonut items={breakdown} />
        </Col>
        <Col xs={24} xl={12}>
          <BalanceChart data={balance} />
        </Col>
      </Row>

      {/* 4 — what still needs attention. Widths follow what is actually
          present: with no budgets, charges take the full row. */}
      <Row gutter={[16, 16]}>
        {hasBudgets && (
          <Col xs={24} xl={12}>
            <BudgetsPanel statuses={budgetStatuses} />
          </Col>
        )}
        <Col xs={24} xl={hasBudgets ? 12 : 24}>
          <FixedExpensesPanel statuses={fxStatuses} summary={fxSummary} />
        </Col>
      </Row>

      {hasApports && <ApportsPanel perPerson={perPerson} />}

      {/* 5 — the detail, last */}
      <RecentTransactions rows={recent} />
    </Flex>
  );
}
