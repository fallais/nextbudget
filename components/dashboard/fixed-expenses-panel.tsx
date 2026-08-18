"use client";

import Link from "next/link";
import { Badge, Card, Empty, Flex, Typography } from "antd";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { FixedExpenseStatus } from "@application/fixed-expenses";
import type { FixedExpensesSummary } from "@application/fixed-expenses";

const { Text } = Typography;

/** Each state gets a word and a dot — never the dot alone. */
const STATE = {
  paid: { label: "Payé", color: STATUS.good },
  pending: { label: "À venir", color: STATUS.warning },
  overdue: { label: "En retard", color: STATUS.critical },
  anomaly: { label: "Montant inhabituel", color: STATUS.serious },
} as const;

/**
 * What is still due this month.
 *
 * Ordered by what needs attention — overdue, then anomalies, then pending —
 * rather than by due day, because the point of this panel is the exceptions.
 */
export function FixedExpensesPanel({
  statuses,
  summary,
}: {
  statuses: FixedExpenseStatus[];
  summary: FixedExpensesSummary;
}) {
  if (statuses.length === 0) {
    return (
      <Card title="Frais fixes" style={{ height: "100%" }}>
        <Empty description="Aucune charge fixe enregistrée" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const rank = { overdue: 0, anomaly: 1, pending: 2, paid: 3 } as const;
  const rows = [...statuses].sort((a, b) => rank[a.state] - rank[b.state]).slice(0, 6);

  return (
    <Card
      title="Frais fixes du mois"
      extra={<Link href="/frais-fixes">Tout voir</Link>}
      style={{ height: "100%" }}
    >
      <Flex vertical gap={10}>
        {rows.map((s) => {
          const state = STATE[s.state];
          return (
            <Flex key={s.fixedExpense.id} justify="space-between" align="center" gap={8}>
              <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <Badge color={state.color} />
                <Text ellipsis style={{ fontSize: 13 }}>
                  {s.fixedExpense.name}
                </Text>
              </Flex>
              <Flex align="center" gap={10}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {state.label}
                </Text>
                <Text style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  {formatCents(s.fixedExpense.expectedAmountCents)}
                </Text>
              </Flex>
            </Flex>
          );
        })}
        <Flex justify="space-between" style={{ borderTop: "1px solid rgba(128,128,128,0.2)", paddingTop: 10 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Reste à payer
          </Text>
          <Text strong style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            {formatCents(Math.max(0, summary.expectedTotalCents - summary.paidTotalCents))}
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}
