"use client";

import Link from "next/link";
import { Card, Flex, Progress, Tag, Typography, theme } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { formatCents, formatDateShort } from "@shared/format";
import type { CreditListItem } from "@application/credits";

const { Text } = Typography;

const TYPE_LABELS: Record<string, string> = {
  mortgage: "Crédit immobilier",
  loan: "Prêt",
  other: "Autre",
};

/**
 * One credit, as a list row.
 *
 * Deliberately four figures and one bar. Everything else this app can say about
 * a loan — the cost split, the equity in the financed asset, time against
 * capital, the schedule — lives on its own page, because all of it at once is
 * unreadable when what you came for is "how much is left".
 *
 * Almost no colour: one accent on the progress, and the rest in ordinary text.
 * Every figure is labelled, so nothing needs a hue to be understood.
 */
export function CreditRow({ item }: { item: CreditListItem }) {
  const { credit, summary, linkedAsset } = item;
  const { token } = theme.useToken();

  const principal = credit.principalCents ?? 0;
  const progress = summary?.progress ?? null;
  const paidPct =
    progress && principal > 0
      ? Math.round((progress.principalPaidCents / principal) * 100)
      : null;

  return (
    <Card
      size="small"
      hoverable
      styles={{ body: { padding: 16 } }}
      // The whole row is the link — a card you can click anywhere on beats
      // hunting for a small "détail" target.
      onClick={() => {}}
    >
      <Link href={`/credits/${credit.id}`} style={{ color: "inherit", display: "block" }}>
        <Flex justify="space-between" align="center" gap={16} wrap>
          <Flex vertical gap={2} style={{ minWidth: 200, flex: 1 }}>
            <Flex align="center" gap={8} wrap>
              <Text strong>{credit.name}</Text>
              <Tag bordered={false}>{TYPE_LABELS[credit.type] ?? credit.type}</Tag>
              {!credit.isActive && <Tag bordered={false}>Soldé</Tag>}
            </Flex>
            {linkedAsset && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                finance {linkedAsset.name}
              </Text>
            )}
          </Flex>

          <Figure label="Restant dû" value={formatCents(credit.valueCents)} strong />
          {summary && (
            <Figure label="Échéance" value={`${formatCents(summary.monthlyPaymentCents)}/mois`} />
          )}
          {summary?.endDate && <Figure label="Fin" value={formatDateShort(summary.endDate)} />}

          <RightOutlined style={{ color: token.colorTextQuaternary }} />
        </Flex>

        {paidPct !== null && (
          <Flex align="center" gap={10} style={{ marginTop: 12 }}>
            <Progress
              percent={paidPct}
              showInfo={false}
              size={["100%", 6]}
              strokeColor={token.colorPrimary}
            />
            <Text
              type="secondary"
              style={{ fontSize: 12, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
            >
              {paidPct} % remboursé
            </Text>
          </Flex>
        )}
      </Link>
    </Card>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Flex vertical gap={0} style={{ minWidth: 116 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text strong={strong} style={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}>
        {value}
      </Text>
    </Flex>
  );
}
