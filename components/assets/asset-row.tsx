"use client";

import Link from "next/link";
import { Card, Flex, Tag, Tooltip, Typography, theme } from "antd";
import {
  BankOutlined,
  CarOutlined,
  HomeOutlined,
  LineChartOutlined,
  RightOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { formatCents } from "@shared/format";
import type { AssetRow as Asset } from "@domain/entities";

const { Text } = Typography;

/**
 * The type, as an icon. The label rides along in the tooltip and `aria-label`
 * rather than being dropped — a pictogram is not a name.
 */
const TYPE_ICON: Record<string, { icon: React.ReactNode; label: string }> = {
  real_estate: { icon: <HomeOutlined />, label: "Immobilier" },
  vehicle: { icon: <CarOutlined />, label: "Véhicule" },
  savings: { icon: <WalletOutlined />, label: "Épargne" },
  investment: { icon: <LineChartOutlined />, label: "Investissement" },
  mortgage: { icon: <HomeOutlined />, label: "Crédit immobilier" },
  loan: { icon: <BankOutlined />, label: "Prêt" },
  other: { icon: <BankOutlined />, label: "Autre" },
};

/**
 * One item of the patrimoine, as a list row — the same shape as a credit row,
 * so the two pages read the same way.
 *
 * `share` is what the selected person owns of it; with the whole household
 * selected it is the full value and no share line is drawn.
 */
export function AssetItemRow({
  asset,
  shareCents,
  shareLabel,
}: {
  asset: Asset;
  shareCents: number;
  shareLabel: string | null;
}) {
  const { token } = theme.useToken();
  const type = TYPE_ICON[asset.type] ?? TYPE_ICON.other;
  const isDebt = asset.kind === "liability";

  return (
    <Card size="small" hoverable styles={{ body: { padding: 14 } }}>
      <Link href={`/patrimoine/${asset.id}`} style={{ color: "inherit", display: "block" }}>
        <Flex align="center" gap={14} wrap>
          <Tooltip title={type.label}>
            <span aria-label={type.label} style={{ color: token.colorTextTertiary, fontSize: 16 }}>
              {type.icon}
            </span>
          </Tooltip>

          <Flex vertical gap={0} style={{ minWidth: 180, flex: 1 }}>
            <Flex align="center" gap={8} wrap>
              <Text strong>{asset.name}</Text>
              {isDebt && (
                <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
                  Passif
                </Tag>
              )}
              {!asset.isActive && <Tag bordered={false}>Inactif</Tag>}
            </Flex>
            {shareLabel && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {shareLabel}
              </Text>
            )}
          </Flex>

          <Flex vertical gap={0} style={{ minWidth: 130, textAlign: "right" }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {isDebt ? "Restant dû" : "Valeur"}
            </Text>
            {/* The label above says which it is, so the sign carries direction
                without a colour repeating it. */}
            <Text strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}>
              {isDebt ? "−" : ""}
              {formatCents(shareCents)}
            </Text>
          </Flex>

          <RightOutlined style={{ color: token.colorTextQuaternary }} />
        </Flex>
      </Link>
    </Card>
  );
}
