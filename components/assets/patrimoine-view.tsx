"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Popconfirm,
  Row,
  Segmented,
  Table,
  Tooltip,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PALETTES } from "@shared/palette";
import { formatBps } from "@domain/value-objects/share";
import { formatCents, formatCentsCompact, formatDateShort } from "@shared/format";
import { PageHeader } from "@/components/layout/page-header";
import { AssetForm, type FormPerson } from "./asset-form";
import type { AssetRow } from "@domain/entities";
import type { OwnerShareRow } from "@domain/value-objects/share";
import type { NetWorth, NetWorthBreakdown, NetWorthPoint } from "@application/assets";

const { Text } = Typography;

const TYPE_LABELS: Record<string, string> = {
  real_estate: "Immobilier",
  vehicle: "Véhicule",
  savings: "Épargne",
  investment: "Investissement",
  loan: "Prêt",
  mortgage: "Crédit immobilier",
  other: "Autre",
};

/**
 * Patrimoine: what you own, what you owe, and the difference.
 *
 * The net worth leads and the subtraction behind it is drawn rather than
 * asserted — one bar of assets against debts says more than two numbers side
 * by side. Below: how the wealth is composed, how it has moved, and the items
 * in a single filterable table instead of two, so there is one place to look
 * and one thing to scroll.
 *
 * Colour appears once, as the accent on bars and the trend line. Everything is
 * labelled, so nothing depends on a hue to be understood.
 */
export function PatrimoineView({
  assets,
  netWorth,
  history,
  breakdown,
  ownersByAsset,
  persons,
  accounts,
  mePersonId,
}: {
  assets: AssetRow[];
  netWorth: NetWorth;
  history: NetWorthPoint[];
  breakdown: NetWorthBreakdown | null;
  ownersByAsset: Record<number, OwnerShareRow[]>;
  persons: FormPerson[];
  accounts: { id: number; name: string }[];
  mePersonId: number | null;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const { resolvedTheme } = useTheme();
  const { token } = theme.useToken();
  const line = PALETTES.bleu.series[resolvedTheme === "dark" ? "dark" : "light"][0];

  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "asset" | "liability">("all");

  function openForm(a: AssetRow | null) {
    setEditing(a);
    setFormOpen(true);
  }

  async function remove(a: AssetRow) {
    const res = await fetch(`/api/assets/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    message.success("Supprimé");
    router.refresh();
  }

  const nameOf = (id: number) => persons.find((p) => p.id === id)?.name ?? "—";

  /** "Alex 60 % · Camille 40 %", or nothing for a solo household. */
  function shares(assetId: number): string | null {
    if (persons.length < 2) return null;
    const rows = ownersByAsset[assetId];
    if (!rows?.length) return null;
    return rows.map((o) => `${nameOf(o.personId)} ${formatBps(o.shareBps)}`).join(" · ");
  }

  /** Assets grouped by type, biggest first — what the wealth is made of. */
  const composition = useMemo(() => {
    const byType = new Map<string, number>();
    for (const a of assets.filter((x) => x.kind === "asset" && x.isActive)) {
      byType.set(a.type, (byType.get(a.type) ?? 0) + a.valueCents);
    }
    return [...byType.entries()]
      .map(([type, cents]) => ({ type, cents }))
      .sort((a, b) => b.cents - a.cents);
  }, [assets]);

  const rows = assets.filter((a) => filter === "all" || a.kind === filter);
  const gross = netWorth.assetsCents + netWorth.liabilitiesCents;
  const assetsShare = gross > 0 ? (netWorth.assetsCents / gross) * 100 : 100;

  const columns: ColumnsType<AssetRow> = [
    {
      title: "Nom",
      dataIndex: "name",
      render: (name: string, a) => (
        <Flex vertical gap={0}>
          <Text>{name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {TYPE_LABELS[a.type] ?? a.type}
            {shares(a.id) ? ` · ${shares(a.id)}` : ""}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Nature",
      dataIndex: "kind",
      width: 100,
      responsive: ["sm"],
      render: (k: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {k === "liability" ? "Passif" : "Actif"}
        </Text>
      ),
    },
    {
      title: "Valeur",
      dataIndex: "valueCents",
      align: "right",
      width: 150,
      // The Nature column says which it is, so the sign carries the direction
      // without needing a colour to repeat it.
      render: (cents: number, a) => (
        <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {a.kind === "liability" ? "−" : ""}
          {formatCents(cents)}
        </Text>
      ),
    },
    {
      title: "",
      width: 76,
      align: "right",
      render: (_, a) => (
        <Flex gap={2} justify="flex-end">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openForm(a)}
            aria-label={`Modifier ${a.name}`}
          />
          <Popconfirm
            title={`Supprimer « ${a.name} » ?`}
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={() => remove(a)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Patrimoine" }]}
        description="Ce que vous possédez, ce que vous devez, et la différence."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
            Ajouter
          </Button>
        }
      />

      {/* The headline, with the subtraction drawn rather than asserted. */}
      <Card>
        <Flex vertical gap={14}>
          <Flex justify="space-between" align="flex-end" wrap gap={12}>
            <Flex vertical gap={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Valeur nette
              </Text>
              <Text strong style={{ fontSize: 34, fontVariantNumeric: "tabular-nums" }}>
                {formatCents(netWorth.netCents)}
              </Text>
            </Flex>
            <Flex gap={28} wrap>
              <Figure label="Actifs" value={formatCents(netWorth.assetsCents)} />
              <Figure label="Passifs" value={`−${formatCents(netWorth.liabilitiesCents)}`} />
            </Flex>
          </Flex>

          {gross > 0 && (
            <Flex vertical gap={6}>
              <Flex style={{ width: "100%", height: 12, gap: 2 }}>
                <Tooltip title={`Actifs ${formatCents(netWorth.assetsCents)}`}>
                  <div
                    style={{
                      width: `${assetsShare}%`,
                      background: token.colorPrimary,
                      borderRadius: 4,
                    }}
                  />
                </Tooltip>
                <Tooltip title={`Passifs ${formatCents(netWorth.liabilitiesCents)}`}>
                  <div
                    style={{
                      width: `${100 - assetsShare}%`,
                      background: token.colorPrimary,
                      opacity: 0.3,
                      borderRadius: 4,
                    }}
                  />
                </Tooltip>
              </Flex>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Vos dettes représentent {Math.round(100 - assetsShare)} % de ce que vous possédez.
              </Text>
            </Flex>
          )}
        </Flex>
      </Card>

      {breakdown && breakdown.byPerson.length > 0 && (
        <Card size="small" title="Par personne">
          <Flex gap={32} wrap>
            {breakdown.byPerson.map((p) => (
              <Figure
                key={p.personId}
                label={p.personName}
                value={formatCents(p.netCents)}
                hint={`${formatCents(p.assetsCents)} d'actifs · ${formatCents(p.liabilitiesCents)} de passifs`}
              />
            ))}
            {breakdown.unattributedNetCents !== 0 && (
              <Figure
                label="Non rattaché"
                value={formatCents(breakdown.unattributedNetCents)}
                hint="aucune quote-part renseignée"
              />
            )}
          </Flex>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card size="small" title="Évolution de la valeur nette" style={{ height: "100%" }}>
            {history.length === 0 ? (
              <Empty
                description="Aucun relevé enregistré pour l'instant"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div style={{ width: "100%", height: 220, minWidth: 0 }}>
                <ResponsiveContainer>
                  <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={line} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={line} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={token.colorBorderSecondary} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => formatDateShort(d)}
                      tick={{ fill: token.colorTextTertiary, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCentsCompact(v)}
                      tick={{ fill: token.colorTextTertiary, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <RTooltip
                      formatter={(v) => [formatCents(Number(v)), "Valeur nette"] as [string, string]}
                      labelFormatter={(d) => formatDateShort(String(d))}
                      contentStyle={{
                        background: token.colorBgElevated,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadius,
                        color: token.colorText,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="netCents"
                      stroke={line}
                      strokeWidth={2}
                      fill="url(#netWorthFill)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card size="small" title="Composition des actifs" style={{ height: "100%" }}>
            {composition.length === 0 ? (
              <Empty description="Aucun actif" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Flex vertical gap={12}>
                {composition.map((c, i) => {
                  const pct =
                    netWorth.assetsCents > 0
                      ? Math.round((c.cents / netWorth.assetsCents) * 100)
                      : 0;
                  return (
                    <Flex key={c.type} vertical gap={4}>
                      <Flex justify="space-between" align="baseline">
                        <Text style={{ fontSize: 13 }}>{TYPE_LABELS[c.type] ?? c.type}</Text>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatCents(c.cents)} · {pct} %
                        </Text>
                      </Flex>
                      {/* One hue, stepped by rank — the ramp carries the order. */}
                      <div
                        style={{ height: 6, background: token.colorFillSecondary, borderRadius: 3 }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: token.colorPrimary,
                            opacity: Math.max(0.35, 1 - i * 0.18),
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </Flex>
                  );
                })}
              </Flex>
            )}
          </Card>
        </Col>
      </Row>

      {/* One table with a filter rather than two: one place to look, one thing
          to scroll, and a third nature later costs nothing. */}
      <Card
        size="small"
        title="Éléments"
        extra={
          <Segmented
            size="small"
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: "all", label: `Tout (${assets.length})` },
              {
                value: "asset",
                label: `Actifs (${assets.filter((a) => a.kind === "asset").length})`,
              },
              {
                value: "liability",
                label: `Passifs (${assets.filter((a) => a.kind === "liability").length})`,
              },
            ]}
          />
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: "Rien à afficher" }}
        />
      </Card>

      <AssetForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
        accounts={accounts}
        persons={persons}
        owners={editing ? (ownersByAsset[editing.id] ?? []) : []}
        mePersonId={mePersonId}
        linkableAssets={assets
          .filter((a) => a.kind === "asset")
          .map((a) => ({ id: a.id, name: a.name }))}
      />
    </Flex>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
      {hint && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {hint}
        </Text>
      )}
    </Flex>
  );
}
