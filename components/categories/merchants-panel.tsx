"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Empty, Flex, Select, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { UndoOutlined } from "@ant-design/icons";
import type { CategoryRow } from "@domain/entities";
import type { MerchantView } from "@application/categorize/merchants";

const { Text } = Typography;

/**
 * The shipped catalogue, as it applies to one category.
 *
 * These are not rows you own — they come with the app and improve with it —
 * so the only things offered are the three decisions that are yours: send this
 * merchant somewhere else, switch it off, or put it back the way we ship it.
 * Everything you do here is stored as that decision alone, which is why a
 * later release can still fix a pattern you never touched.
 */
export function MerchantsPanel({
  category,
  categories,
  merchants,
}: {
  category: CategoryRow;
  categories: CategoryRow[];
  merchants: MerchantView[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const here = merchants.filter((m) => m.categoryId === category.id);
  const elsewhere = merchants.filter((m) => m.categoryId !== category.id);

  async function save(key: string, body: { categoryId: number | null; disabled: boolean }) {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/merchants/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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

  async function reset(key: string) {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/merchants/${key}`, { method: "DELETE" });
      if (!res.ok) {
        message.error("Échec de la réinitialisation");
        return;
      }
      message.success("Réglage par défaut rétabli");
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
            {m.overridden && !m.disabled && (
              <Tooltip title={`Par défaut : ${m.defaultCategoryName}`}>
                <Tag bordered={false} color="processing" style={{ marginInlineEnd: 0 }}>
                  déplacé
                </Tag>
              </Tooltip>
            )}
          </Flex>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {m.patterns.join(" · ")}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Catégorie",
      width: 210,
      render: (_, m) => (
        <Select
          size="small"
          style={{ width: "100%" }}
          value={m.categoryId ?? undefined}
          loading={busyKey === m.key}
          disabled={busyKey === m.key}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(categoryId) =>
            save(m.key, {
              // Re-pointing back to its own default is a reset, not an override.
              categoryId: categoryId === m.defaultCategoryId ? null : categoryId,
              disabled: m.disabled,
            })
          }
        />
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
          onChange={(active) =>
            save(m.key, {
              categoryId: m.overridden && m.categoryId !== m.defaultCategoryId ? m.categoryId : null,
              disabled: !active,
            })
          }
        />
      ),
    },
    {
      title: "",
      width: 44,
      align: "right",
      render: (_, m) =>
        m.overridden ? (
          <Tooltip title="Revenir au réglage livré">
            <Button
              type="text"
              size="small"
              icon={<UndoOutlined />}
              aria-label="Réinitialiser"
              loading={busyKey === m.key}
              onClick={() => reset(m.key)}
            />
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Card
      title={`Marchands reconnus (${here.length})`}
      extra={
        <Select
          size="small"
          showSearch
          allowClear
          style={{ minWidth: 240 }}
          placeholder="Rattacher un marchand connu…"
          optionFilterProp="label"
          value={null}
          options={elsewhere.map((m) => ({
            value: m.key,
            label: `${m.name} — ${m.kindLabel}`,
          }))}
          onChange={(key) => key && save(key, { categoryId: category.id, disabled: false })}
        />
      }
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
