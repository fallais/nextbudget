"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Flex,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { Money } from "@/components/money";
import { formatDateShort } from "@shared/format";
import type { CategoryRow, AccountRow } from "@domain/entities";
import type { ListedTransaction } from "@application/queries";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * Transactions: a filter bar over a dense table.
 *
 * The filters sit in one row above the data rather than in a left rail — a
 * 280px sidebar costs a fifth of the width permanently, and this page is about
 * reading rows. Everything is driven through the URL so a filtered view is
 * a link you can keep.
 *
 * Categorising is inline in the table: it is the single most repeated action
 * here, and sending someone to a modal for each row would make the common case
 * the slow one.
 */
export function TransactionsView({
  rows,
  total,
  page,
  pageSize,
  categories,
  accounts,
}: {
  rows: ListedTransaction[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryRow[];
  accounts: AccountRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [saving, setSaving] = useState<number | null>(null);

  /** Every filter is a URL parameter; empty values drop out so links stay short. */
  function apply(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    // Any filter change invalidates the page number — page 7 of a new result
    // set is almost always empty.
    if (!("page" in changes)) next.delete("page");
    startTransition(() => router.push(`/transactions?${next.toString()}`));
  }

  async function setCategory(row: ListedTransaction, categoryId: number | null) {
    setSaving(row.id);
    try {
      const res = await fetch(`/api/transactions/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) {
        message.error("Échec de la catégorisation");
        return;
      }
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range: [Dayjs, Dayjs] | undefined =
    from && to ? [dayjs(from), dayjs(to)] : undefined;

  const columns: ColumnsType<ListedTransaction> = [
    {
      title: "Date",
      dataIndex: "date",
      width: 100,
      render: (d: string) => <Text type="secondary">{formatDateShort(d)}</Text>,
    },
    { title: "Libellé", dataIndex: "description", ellipsis: true },
    {
      title: "Compte",
      dataIndex: "account",
      width: 150,
      responsive: ["xl"],
      render: (_, row) => <Text type="secondary">{row.account?.name ?? "—"}</Text>,
    },
    {
      title: "Catégorie",
      dataIndex: "category",
      width: 210,
      render: (_, row) => (
        <Select
          size="small"
          style={{ width: "100%" }}
          placeholder="Non catégorisé"
          value={row.category?.id ?? undefined}
          loading={saving === row.id}
          allowClear
          showSearch
          optionFilterProp="label"
          onChange={(v) => setCategory(row, v ?? null)}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      ),
    },
    {
      title: "Montant",
      dataIndex: "amountCents",
      align: "right",
      width: 130,
      // The header names the column, so the sign alone carries direction.
      render: (cents: number) => <Money cents={cents} />,
    },
  ];

  const exportHref = `/api/transactions/export?${searchParams.toString()}`;

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Transactions
          </Title>
          <Text type="secondary">
            {total.toLocaleString("fr-FR")} opération{total > 1 ? "s" : ""}
          </Text>
        </div>
        <Button icon={<DownloadOutlined />} href={exportHref}>
          Exporter
        </Button>
      </Flex>

      <Card size="small">
        <Flex gap={10} wrap align="center">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Rechercher un libellé"
            style={{ width: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => apply({ search })}
            onBlur={() => apply({ search })}
          />
          <RangePicker
            value={range}
            format="DD/MM/YYYY"
            onChange={(dates) =>
              apply({
                from: dates?.[0]?.format("YYYY-MM-DD"),
                to: dates?.[1]?.format("YYYY-MM-DD"),
              })
            }
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Catégories"
            style={{ minWidth: 200 }}
            maxTagCount="responsive"
            optionFilterProp="label"
            value={(searchParams.get("categoryIds") ?? "").split(",").filter(Boolean).map(Number)}
            onChange={(v: number[]) => apply({ categoryIds: v.join(",") })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          {accounts.length > 1 && (
            <Select
              mode="multiple"
              allowClear
              placeholder="Comptes"
              style={{ minWidth: 180 }}
              maxTagCount="responsive"
              optionFilterProp="label"
              value={(searchParams.get("accountIds") ?? "").split(",").filter(Boolean).map(Number)}
              onChange={(v: number[]) => apply({ accountIds: v.join(",") })}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          )}
          <Checkbox
            checked={searchParams.get("uncategorized") === "1"}
            onChange={(e) => apply({ uncategorized: e.target.checked ? "1" : undefined })}
          >
            À catégoriser
          </Checkbox>
          {searchParams.toString() && (
            <Button type="link" onClick={() => startTransition(() => router.push("/transactions"))}>
              Réinitialiser
            </Button>
          )}
        </Flex>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="small"
          loading={pending}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: "Aucune transaction pour ces filtres" }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => apply({ page: String(p) }),
            showTotal: (t, r) => `${r[0]}–${r[1]} sur ${t.toLocaleString("fr-FR")}`,
          }}
        />
      </Card>
    </Flex>
  );
}

export { Tag };
