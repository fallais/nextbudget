"use client";

import Link from "next/link";
import { Card, Flex, Tag, Typography, theme } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { CategoryBudgetStatus } from "@application/budgets";

const { Text } = Typography;

/**
 * One budget, as a list row — the same shape as a credit or a patrimoine row,
 * so the three pages read the same way.
 *
 * Four labelled figures and one bar. Colour appears only where it means
 * something: the bar turns when the ceiling is close and again when it is
 * passed, and both states are also written in words, because a hue alone is
 * unreadable to a colour-blind eye and to anyone glancing.
 */
export function BudgetItemRow({ status }: { status: CategoryBudgetStatus }) {
  const { token } = theme.useToken();

  const pct = Math.min(100, Math.round(status.ratio * 100));
  const over = status.ratio >= 1;
  const near = status.ratio >= 0.8 && !over;
  const color = over ? STATUS.critical : near ? STATUS.warning : token.colorPrimary;

  return (
    <Card size="small" hoverable styles={{ body: { padding: 14 } }}>
      <Link href={`/budgets/${status.id}`} style={{ color: "inherit", display: "block" }}>
        <Flex vertical gap={10}>
          <Flex align="center" gap={16} wrap>
            <Flex align="center" gap={8} style={{ minWidth: 170, flex: 1 }}>
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: status.category.color,
                  flex: "none",
                }}
              />
              <Text strong>{status.category.name}</Text>
              {status.period === "weekly" && (
                <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
                  par semaine
                </Tag>
              )}
            </Flex>

            <Figure label="Dépensé" value={formatCents(status.spentCents)} strong />
            <Figure label="Plafond" value={formatCents(status.budgetCents)} />
            <Figure
              label={over ? "Dépassement" : "Reste"}
              value={formatCents(Math.abs(status.remainingCents))}
              color={over ? STATUS.critical : undefined}
            />
            <Figure
              label="Fin de période"
              value={
                status.daysRemaining === 0 ? "aujourd'hui" : `dans ${status.daysRemaining} j`
              }
            />

            <RightOutlined style={{ color: token.colorTextQuaternary }} />
          </Flex>

          <div style={{ height: 6, background: token.colorFillSecondary, borderRadius: 3 }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: color,
                borderRadius: 3,
              }}
            />
          </div>
        </Flex>
      </Link>
    </Card>
  );
}

function Figure({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <Flex vertical gap={0} style={{ minWidth: 110 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text strong={strong} style={{ fontVariantNumeric: "tabular-nums", fontSize: 15, color }}>
        {value}
      </Text>
    </Flex>
  );
}
