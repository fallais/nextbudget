"use client";

import Link from "next/link";
import { Card, Flex, Progress, Tag, Tooltip, Typography, theme } from "antd";
import { BankOutlined, CarOutlined, HomeOutlined, RightOutlined } from "@ant-design/icons";
import { formatCents, formatDateShort } from "@shared/format";
import type { CreditListItem } from "@application/credits";

const { Text } = Typography;

/**
 * The loan type, as an icon.
 *
 * The label is carried by the tooltip and by `aria-label` rather than dropped:
 * a shape alone is not a name, and "Prêt" and "Crédit immobilier" have to stay
 * distinguishable to a screen reader and to anyone who does not read the
 * pictogram the way we intended.
 */
const TYPE_ICON: Record<string, { icon: React.ReactNode; label: string }> = {
  mortgage: { icon: <HomeOutlined />, label: "Crédit immobilier" },
  loan: { icon: <CarOutlined />, label: "Prêt" },
  other: { icon: <BankOutlined />, label: "Autre crédit" },
};

/**
 * One credit, as a list row.
 *
 * Deliberately a gauge and four figures. Everything else this app can say about
 * a loan — the cost split, the equity in the financed asset, time against
 * capital, the schedule — lives on its own page, because all of it at once is
 * unreadable when what you came for is "how much is left".
 *
 * Almost no colour: one accent on the gauge, the rest ordinary text. Every
 * figure is labelled, so nothing needs a hue to be understood.
 */
export function CreditRow({ item }: { item: CreditListItem }) {
  const { credit, summary } = item;
  const { token } = theme.useToken();

  const principal = credit.principalCents ?? 0;
  const progress = summary?.progress ?? null;
  const paidPct =
    progress && principal > 0
      ? Math.round((progress.principalPaidCents / principal) * 100)
      : null;

  const type = TYPE_ICON[credit.type] ?? TYPE_ICON.other;

  return (
    <Card size="small" hoverable styles={{ body: { padding: 16 } }}>
      <Link href={`/credits/${credit.id}`} style={{ color: "inherit", display: "block" }}>
        <Flex align="center" gap={20} wrap>
          {paidPct !== null && (
            <Tooltip title={`${paidPct} % du capital remboursé`}>
              <Progress
                type="circle"
                size={62}
                percent={paidPct}
                strokeColor={token.colorPrimary}
                strokeWidth={9}
                format={(p) => <Text style={{ fontSize: 14, fontWeight: 600 }}>{p}%</Text>}
              />
            </Tooltip>
          )}

          <Flex align="center" gap={8} style={{ minWidth: 180, flex: 1 }}>
            <Tooltip title={type.label}>
              <span aria-label={type.label} style={{ color: token.colorTextTertiary, fontSize: 16 }}>
                {type.icon}
              </span>
            </Tooltip>
            <Text strong>{credit.name}</Text>
            {!credit.isActive && <Tag bordered={false}>Soldé</Tag>}
          </Flex>

          <Figure label="Restant dû" value={formatCents(credit.valueCents)} strong />
          {summary && (
            <Figure label="Échéance" value={`${formatCents(summary.monthlyPaymentCents)}/mois`} />
          )}
          {summary?.endDate && <Figure label="Fin" value={formatDateShort(summary.endDate)} />}

          <RightOutlined style={{ color: token.colorTextQuaternary }} />
        </Flex>
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
