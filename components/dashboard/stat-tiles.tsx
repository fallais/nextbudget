"use client";

import Link from "next/link";
import { Card, Col, Flex, Row, Tag, Typography, theme } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { MONEY, STATUS } from "@shared/palette";
import { formatCents, formatPercent } from "@shared/format";
import type { PeriodSummary } from "@application/stats";
import type { ActualNetCashflow } from "@application/reste-a-vivre";

const { Text } = Typography;

/**
 * The second read: am I on track this period?
 *
 * Four figures, deliberately small — they exist to be scanned, not studied.
 * Anything that needs studying is a chart further down.
 */
export function StatTiles({
  summary,
  soldeNet,
  periodLabel,
}: {
  summary: PeriodSummary;
  soldeNet: ActualNetCashflow;
  periodLabel: string;
}) {
  const { token } = theme.useToken();

  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} lg={6}>
        <Tile
          label="Dépenses"
          value={formatCents(summary.totalExpensesCents)}
          color={MONEY.expense}
          foot={
            summary.variationPercent === null ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                pas de {periodLabel} précédent
              </Text>
            ) : (
              // Spending less than last period is the good direction, so the
              // arrow points the way the money moved and the colour follows
              // the meaning, not the sign.
              <Text style={{ fontSize: 12, color: summary.variationPercent > 0 ? MONEY.expense : MONEY.income }}>
                {summary.variationPercent > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{" "}
                {formatPercent(Math.abs(summary.variationPercent))} vs {periodLabel} précédent
              </Text>
            )
          }
        />
      </Col>

      <Col xs={12} lg={6}>
        <Tile label="Revenus" value={formatCents(summary.totalIncomeCents)} color={MONEY.income} />
      </Col>

      <Col xs={12} lg={6}>
        <Tile
          label="Solde net"
          value={formatCents(soldeNet.netCents)}
          color={soldeNet.netCents >= 0 ? MONEY.income : MONEY.expense}
          foot={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {soldeNet.netCents >= 0 ? "épargné" : "puisé dans l'épargne"} · {soldeNet.monthLabel}
            </Text>
          }
        />
      </Col>

      <Col xs={12} lg={6}>
        <Tile
          label="À catégoriser"
          value={String(summary.uncategorizedCount)}
          color={summary.uncategorizedCount > 0 ? STATUS.warning : token.colorTextDescription}
          foot={
            summary.uncategorizedCount > 0 ? (
              <Link href="/transactions?uncategorized=1" style={{ fontSize: 12 }}>
                Les classer →
              </Link>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                tout est classé
              </Text>
            )
          }
        />
      </Col>
    </Row>
  );
}

function Tile({
  label,
  value,
  color,
  foot,
}: {
  label: string;
  value: string;
  color?: string;
  foot?: React.ReactNode;
}) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <Flex vertical gap={2}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {label}
        </Text>
        <Text strong style={{ fontSize: 22, color, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Text>
        {foot}
      </Flex>
    </Card>
  );
}

export { Tag };
