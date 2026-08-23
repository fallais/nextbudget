"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Flex,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, SearchOutlined, SwapOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { Money } from "@/components/money";
import { formatCents, formatDateShort } from "@shared/format";
import { MONEY } from "@shared/palette";
import type { CategoryRow, AccountRow } from "@domain/entities";
import type {
  AccountBalance,
  ListedTransaction,
  TransactionTotals,
} from "@application/queries";

const { Text } = Typography;
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
  totals,
  balances,
  page,
  pageSize,
  categories,
  accounts,
}: {
  rows: ListedTransaction[];
  total: number;
  totals: TransactionTotals;
  balances: AccountBalance[];
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
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

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

  const selectedRows = rows.filter((r) => selected.includes(r.id));

  /**
   * Declare the selection one move between your own accounts.
   *
   * Both legs at once when both are on file; one alone when the other account
   * is not tracked here, which the API allows on purpose.
   */
  async function linkSelected() {
    setBusy(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transactionIds: selected }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        message.error(data?.error ?? "Échec du marquage");
        return;
      }
      message.success("Virement interne : exclu des dépenses et des revenus");
      setSelected([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** Put the selected legs back in the spending figures, transfer by transfer. */
  async function unlinkSelected() {
    const groups = [...new Set(selectedRows.map((r) => r.transferGroupId).filter(Boolean))];
    setBusy(true);
    try {
      for (const groupId of groups) {
        await fetch(`/api/transfers/${groupId}`, { method: "DELETE" });
      }
      message.success("Opérations remises dans les dépenses");
      setSelected([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** For statements imported before the app knew what a transfer was. */
  async function detectTransfers() {
    setBusy(true);
    try {
      const res = await fetch("/api/transfers/detect", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { pairs?: number } | null;
      if (!res.ok) {
        message.error("Échec de la détection");
        return;
      }
      const pairs = data?.pairs ?? 0;
      if (pairs === 0) message.info("Aucun nouveau virement interne trouvé");
      else message.success(`${pairs} virement(s) interne(s) reconnu(s)`);
      router.refresh();
    } finally {
      setBusy(false);
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
    {
      title: "Libellé",
      dataIndex: "description",
      ellipsis: true,
      render: (_, row) => (
        <Flex gap={8} align="center">
          <Text ellipsis>{row.description}</Text>
          {row.transferGroupId && (
            // Said out loud, because this row is missing from the figures on
            // the dashboard and there would otherwise be no way to know why.
            <Tooltip title="Virement entre vos comptes : ni dépense ni revenu">
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                Virement
              </Tag>
            </Tooltip>
          )}
        </Flex>
      ),
    },
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

  // A balance only exists for an account whose opening balance was recorded;
  // the others contribute movements and nothing more, so they are counted out
  // loud rather than folded into a figure that would then be wrong.
  const anchored = balances.filter((b) => b.balanceCents != null);
  const soldeCents = anchored.reduce((sum, b) => sum + (b.balanceCents ?? 0), 0);
  const unanchored = balances.length - anchored.length;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Transactions" }]}
        description={`${total.toLocaleString("fr-FR")} opération${total > 1 ? "s" : ""}`}
        actions={
          <Flex gap={8}>
            <Button icon={<SwapOutlined />} loading={busy} onClick={detectTransfers}>
              Détecter les virements
            </Button>
            <Button icon={<DownloadOutlined />} href={exportHref}>
              Exporter
            </Button>
          </Flex>
        }
      />

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
          {/* Signed, and in euros: a filter typed as −50 to −10 reads the way
              the amounts in the table below do. */}
          <Flex gap={6} align="center">
            <InputNumber
              style={{ width: 118 }}
              placeholder="Montant min"
              step={10}
              value={euros(searchParams.get("amountMin"))}
              onChange={(v) => apply({ amountMin: cents(v) })}
            />
            <Text type="secondary">–</Text>
            <InputNumber
              style={{ width: 118 }}
              placeholder="max"
              step={10}
              value={euros(searchParams.get("amountMax"))}
              onChange={(v) => apply({ amountMax: cents(v) })}
            />
          </Flex>
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

      <Card size="small">
        <Flex gap={28} wrap align="baseline">
          <Figure label="Entrées" cents={totals.inCents} color={MONEY.income} />
          <Figure label="Sorties" cents={totals.outCents} color={MONEY.expense} />
          <Figure label="Net" cents={totals.netCents} strong />
          {anchored.length > 0 ? (
            <Figure
              label={balances.length === 1 ? `Solde · ${balances[0].name}` : "Solde des comptes"}
              cents={soldeCents}
              strong
              foot={
                unanchored > 0
                  ? `${unanchored} compte${unanchored > 1 ? "s" : ""} sans solde de départ`
                  : undefined
              }
            />
          ) : (
            <Text type="secondary" style={{ fontSize: 12, maxWidth: 320 }}>
              Solde indisponible : indiquez le solde de départ du compte dans Paramètres →
              Comptes. Sans lui, seul le net des opérations importées est connu.
            </Text>
          )}
        </Flex>
      </Card>

      {selected.length > 0 && (
        <Card size="small">
          <Flex gap={12} align="center" wrap>
            <Text strong>
              {selected.length} opération{selected.length > 1 ? "s" : ""} sélectionnée
              {selected.length > 1 ? "s" : ""}
            </Text>
            {selectedRows.some((r) => r.transferGroupId) ? (
              <Button icon={<SwapOutlined />} loading={busy} onClick={unlinkSelected}>
                Ce ne sont pas des virements
              </Button>
            ) : (
              <Button icon={<SwapOutlined />} loading={busy} onClick={linkSelected}>
                Marquer comme virement interne
              </Button>
            )}
            <Button type="link" onClick={() => setSelected([])}>
              Annuler
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Un virement entre vos comptes ne compte ni comme dépense ni comme revenu, mais
              reste sur le relevé et dans le solde.
            </Text>
          </Flex>
        </Card>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as number[]),
          }}
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

/** The URL carries cents; the box shows euros. */
function euros(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n / 100 : null;
}

function cents(v: number | string | null | undefined): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? String(Math.round(n * 100)) : undefined;
}

/** One figure in the summary strip: a label, an amount, an optional caveat. */
function Figure({
  label,
  cents,
  color,
  strong = false,
  foot,
}: {
  label: string;
  cents: number;
  color?: string;
  strong?: boolean;
  foot?: string;
}) {
  return (
    <div>
      <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
        {label}
      </Text>
      <Text style={{ color, fontWeight: strong ? 600 : 500, fontSize: 16 }}>
        {formatCents(cents)}
      </Text>
      {foot && (
        <Text type="secondary" style={{ display: "block", fontSize: 11 }}>
          {foot}
        </Text>
      )}
    </div>
  );
}
