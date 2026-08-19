"use client";

import Link from "next/link";
import { Card, Flex, Tag, Typography, theme } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { formatCents } from "@shared/format";
import { FIXED_EXPENSE_STATE } from "./fixed-expense-state";
import type { FixedExpenseStatus } from "@application/fixed-expenses";

const { Text } = Typography;

/** One recurring charge, as a list row — the same shape as a credit or a budget. */
export function FixedExpenseItemRow({ status }: { status: FixedExpenseStatus }) {
  const { token } = theme.useToken();
  const { fixedExpense: fx } = status;
  const state = FIXED_EXPENSE_STATE[status.state];
  const paused = !fx.isActive;

  return (
    <Card size="small" hoverable styles={{ body: { padding: 14 } }}>
      <Link href={`/frais-fixes/${fx.id}`} style={{ color: "inherit", display: "block" }}>
        <Flex align="center" gap={16} wrap>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: paused ? token.colorTextQuaternary : state.color,
              flex: "none",
            }}
          />

          <Flex vertical gap={0} style={{ minWidth: 170, flex: 1 }}>
            <Flex align="center" gap={8} wrap>
              <Text strong>{fx.name}</Text>
              {paused && (
                <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
                  en pause
                </Tag>
              )}
            </Flex>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {paused ? "Non suivie" : state.label}
              {status.category ? ` · ${status.category.name}` : ""}
            </Text>
          </Flex>

          <Figure label="Attendu" value={formatCents(fx.expectedAmountCents)} strong />
          <Figure
            label="Payé ce mois"
            value={status.paidAmountCents ? formatCents(status.paidAmountCents) : "—"}
            color={status.state === "anomaly" ? state.color : undefined}
          />
          <Figure label="Échéance" value={fx.dueDay ? `le ${fx.dueDay}` : "—"} />

          <RightOutlined style={{ color: token.colorTextQuaternary }} />
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
    <Flex vertical gap={0} style={{ minWidth: 118 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text strong={strong} style={{ fontVariantNumeric: "tabular-nums", fontSize: 15, color }}>
        {value}
      </Text>
    </Flex>
  );
}
