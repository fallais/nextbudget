"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Card, Empty, Flex, Switch, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CategoryRow } from "@domain/entities";
import type { MerchantView } from "@application/categorize/merchants";

const { Text } = Typography;

/**
 * The shipped catalogue, as it applies to one category.
 *
 * Read-only but for one switch. These are not rows you own — they come with
 * the app and improve with it — and where a merchant files is the catalogue's
 * to say: a kind maps to a category, and that mapping travels with the
 * release. Moving one entry by hand would freeze it against the next
 * correction, which is why the only decision here is whether it applies at
 * all. Disagreeing with the catalogue is what a rule of your own is for, and a
 * rule outranks it.
 */
export function MerchantsPanel({
  category,
  merchants,
}: {
  category: CategoryRow;
  merchants: MerchantView[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const here = merchants.filter((m) => m.categoryId === category.id);

  async function setDisabled(key: string, disabled: boolean) {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/merchants/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(data?.error ?? "Échec de l'enregistrement");
        return;
      }
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  const columns: ColumnsType<MerchantView> = [
    {
      title: "Marchand",
      render: (_, m) => (
        <Flex vertical gap={2}>
          <Flex align="center" gap={8} wrap>
            <Text strong={!m.disabled} delete={m.disabled}>
              {m.name}
            </Text>
            <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
              {m.kindLabel}
            </Tag>
          </Flex>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {m.patterns.join(" · ")}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Actif",
      width: 70,
      align: "center",
      render: (_, m) => (
        <Switch
          size="small"
          checked={!m.disabled}
          loading={busyKey === m.key}
          onChange={(active) => setDisabled(m.key, !active)}
        />
      ),
    },
  ];

  return (
    <Card
      title={`Marchands reconnus (${here.length})`}
      styles={{ body: { padding: here.length ? 0 : 24 } }}
    >
      {here.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aucun marchand livré ne tombe dans cette catégorie"
        />
      ) : (
        <Table
          rowKey="key"
          size="small"
          columns={columns}
          dataSource={here}
          pagination={here.length > 15 ? { pageSize: 15, size: "small" } : false}
        />
      )}
    </Card>
  );
}
