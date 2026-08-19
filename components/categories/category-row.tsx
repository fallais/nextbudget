"use client";

import Link from "next/link";
import { Card, Flex, Typography, theme } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { formatCents } from "@shared/format";
import type { CategoryRow as Category } from "@domain/entities";

const { Text } = Typography;

/** One category, as a list row — the same shape as a credit or an asset row. */
export function CategoryItemRow({
  category,
  ruleCount,
  merchantCount,
  spentCents,
}: {
  category: Category;
  ruleCount: number;
  merchantCount: number;
  spentCents: number;
}) {
  const { token } = theme.useToken();

  return (
    <Card size="small" hoverable styles={{ body: { padding: 14 } }}>
      <Link href={`/categories/${category.id}`} style={{ color: "inherit", display: "block" }}>
        <Flex align="center" gap={16} wrap>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: category.color,
              flex: "none",
            }}
          />
          <Text strong style={{ minWidth: 150, flex: 1 }}>
            {category.name}
          </Text>

          <Figure label="Dépensé ce mois" value={spentCents > 0 ? formatCents(spentCents) : "—"} strong />
          <Figure label="Règles" value={ruleCount === 0 ? "—" : String(ruleCount)} />
          <Figure label="Marchands reconnus" value={merchantCount === 0 ? "—" : String(merchantCount)} />

          <RightOutlined style={{ color: token.colorTextQuaternary }} />
        </Flex>
      </Link>
    </Card>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Flex vertical gap={0} style={{ minWidth: 130 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text strong={strong} style={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}>
        {value}
      </Text>
    </Flex>
  );
}
