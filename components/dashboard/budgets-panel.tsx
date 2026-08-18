"use client";

import Link from "next/link";
import { Card, Flex, Progress, Typography, theme } from "antd";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { CategoryBudgetStatus } from "@application/budgets";

const { Text } = Typography;

/**
 * Budgets closest to their limit, worst first.
 *
 * Nothing budgeted yet ⇒ no card at all. An empty panel inviting you to set
 * one up is noise on a dashboard you look at daily; the Budgets page in the
 * sidebar is where that invitation belongs.
 */
export function BudgetsPanel({ statuses }: { statuses: CategoryBudgetStatus[] }) {
  const { token } = theme.useToken();
  if (statuses.length === 0) return null;

  const top = [...statuses].sort((a, b) => b.ratio - a.ratio).slice(0, 5);

  return (
    <Card
      title="Budgets en cours"
      extra={<Link href="/budgets">Tout voir</Link>}
      style={{ height: "100%" }}
    >
      <Flex vertical gap={14}>
        {top.map((s) => {
          const pct = Math.min(100, Math.round(s.ratio * 100));
          const over = s.ratio >= 1;
          const near = s.ratio >= 0.8 && s.ratio < 1;
          return (
            <div key={s.category.id}>
              <Flex justify="space-between" align="baseline" gap={8}>
                <Text style={{ fontSize: 13 }} ellipsis>
                  {s.category.name}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {" "}
                    /{s.periodLabel}
                  </Text>
                </Text>
                {/* The over-budget case is stated in words as well as colour —
                    "dépassé" is what a colourblind reader has to go on. */}
                <Text
                  style={{
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums",
                    color: over ? STATUS.critical : token.colorTextSecondary,
                    fontWeight: over ? 600 : undefined,
                  }}
                >
                  {formatCents(s.spentCents)} / {formatCents(s.budgetCents)}
                  {over && " · dépassé"}
                </Text>
              </Flex>
              <Progress
                percent={pct}
                showInfo={false}
                size={["100%", 6]}
                strokeColor={over ? STATUS.critical : near ? STATUS.warning : STATUS.good}
              />
            </div>
          );
        })}
      </Flex>
    </Card>
  );
}
