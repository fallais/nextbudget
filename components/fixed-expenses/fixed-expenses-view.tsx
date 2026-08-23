"use client";

import Link from "next/link";
import { Button, Card, Empty, Flex, Tooltip, Typography, theme } from "antd";
import { LineChartOutlined, PlusOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import { FixedExpenseItemRow } from "./fixed-expense-row";
import { RecurringSuggestions } from "./recurring-suggestions";
import { STATE_RANK } from "./fixed-expense-state";
import type { FixedExpenseStatus, FixedExpensesSummary } from "@application/fixed-expenses";
import type { RecurringCandidate } from "@application/recurring";

const { Text } = Typography;

/**
 * Frais fixes: what leaves the account every month whether you look or not.
 *
 * Ordered by what needs attention — late, then unusual, then still to come —
 * rather than by due day: the page exists for the exceptions, and a calendar
 * order buries them among the ones already settled.
 */
export function FixedExpensesView({
  statuses,
  summary,
  monthElapsedPct,
  suggestions,
  dismissedKeys,
}: {
  statuses: FixedExpenseStatus[];
  summary: FixedExpensesSummary;
  monthElapsedPct: number;
  /** Charges the ledger repeats that nobody has declared. */
  suggestions: RecurringCandidate[];
  dismissedKeys: string[];
}) {
  const { token } = theme.useToken();

  const rows = [...statuses].sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.fixedExpense.name.localeCompare(b.fixedExpense.name, "fr"),
  );

  const remaining = Math.max(0, summary.expectedTotalCents - summary.paidTotalCents);
  const paidPct =
    summary.expectedTotalCents > 0
      ? Math.round((summary.paidTotalCents / summary.expectedTotalCents) * 100)
      : 0;

  const late = summary.overdue;
  const odd = summary.anomaly;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Frais fixes" }]}
        description="Les dépenses récurrentes attendues chaque mois — loyer, énergie, abonnements — et si elles sont bien passées."
        actions={
          <Flex gap={8}>
            <Link href="/frais-fixes/evolution">
              <Button icon={<LineChartOutlined />}>Évolution</Button>
            </Link>
            <Link href="/frais-fixes/nouveau">
              <Button type="primary" icon={<PlusOutlined />}>
                Ajouter une charge
              </Button>
            </Link>
          </Flex>
        }
      />

      {summary.total > 0 && (
        <Card>
          <Flex vertical gap={16}>
            <Flex justify="space-between" align="flex-start" wrap gap={16}>
              <Flex vertical gap={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Reste à payer ce mois
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: 34,
                    fontVariantNumeric: "tabular-nums",
                    color: late > 0 ? STATUS.critical : undefined,
                  }}
                >
                  {formatCents(remaining)}
                </Text>
              </Flex>

              <Flex gap={32} wrap>
                <Figure label="Attendu" value={formatCents(summary.expectedTotalCents)} />
                <Figure label="Payé" value={formatCents(summary.paidTotalCents)} />
                <Figure label="Suivies" value={String(summary.total)} />
              </Flex>
            </Flex>

            <Flex vertical gap={6}>
              {/* Paid against expected, with a mark where the month itself has
                  got to: charges are dated, so being at 40 % on the 28th is a
                  different story from being at 40 % on the 3rd. */}
              <div
                style={{
                  position: "relative",
                  height: 12,
                  background: token.colorFillSecondary,
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, paidPct)}%`,
                    height: "100%",
                    background: late > 0 ? STATUS.critical : token.colorPrimary,
                    borderRadius: 4,
                  }}
                />
                <Tooltip title={`Le mois est écoulé à ${monthElapsedPct} %`}>
                  <div
                    style={{
                      position: "absolute",
                      insetBlock: -3,
                      left: `${monthElapsedPct}%`,
                      width: 2,
                      marginLeft: -1,
                      background: token.colorTextSecondary,
                      borderRadius: 1,
                    }}
                  />
                </Tooltip>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary.paid} charge{summary.paid > 1 ? "s" : ""} payée
                {summary.paid > 1 ? "s" : ""} sur {summary.total}, pour un mois écoulé à{" "}
                {monthElapsedPct} %.
                {late > 0 && ` ${late} en retard.`}
                {odd > 0 && ` ${odd} au montant inhabituel.`}
              </Text>
            </Flex>
          </Flex>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <Empty description="Aucune charge fixe enregistrée" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Link href="/frais-fixes/nouveau">
              <Button type="primary" icon={<PlusOutlined />}>
                Ajouter une charge
              </Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <Flex vertical gap={8}>
          {rows.map((s) => (
            <FixedExpenseItemRow key={s.fixedExpense.id} status={s} />
          ))}
        </Flex>
      )}

      <RecurringSuggestions candidates={suggestions} dismissedKeys={dismissedKeys} />
    </Flex>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
    </Flex>
  );
}
