"use client";

import { useTheme } from "next-themes";
import { Card, Col, Empty, Flex, Row, Statistic, Table, Tag, Typography, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MONEY, PALETTES } from "@shared/palette";
import { formatBps } from "@domain/value-objects/share";
import { formatCents, formatCentsCompact, formatDateShort } from "@shared/format";
import type { AssetRow } from "@domain/entities";
import type { OwnerShareRow } from "@domain/value-objects/share";
import type { NetWorth, NetWorthBreakdown, NetWorthPoint } from "@application/assets";

const { Title, Text } = Typography;

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
 * Net worth leads because it is the only figure that combines both sides;
 * assets and liabilities are shown beside it so the subtraction is visible
 * rather than asserted.
 */
export function PatrimoineView({
  assets,
  netWorth,
  history,
  breakdown,
  ownersByAsset,
  persons,
}: {
  assets: AssetRow[];
  netWorth: NetWorth;
  history: NetWorthPoint[];
  breakdown: NetWorthBreakdown | null;
  ownersByAsset: Record<number, OwnerShareRow[]>;
  persons: { id: number; name: string }[];
}) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const { token } = theme.useToken();
  const line = PALETTES.bleu.series[mode][0];

  const nameOf = (id: number) => persons.find((p) => p.id === id)?.name ?? "—";

  /** "Alex 60 % · Camille 40 %", or nothing for a solo household. */
  function shares(assetId: number): string | null {
    if (persons.length < 2) return null;
    const rows = ownersByAsset[assetId];
    if (!rows?.length) return null;
    return rows.map((o) => `${nameOf(o.personId)} ${formatBps(o.shareBps)}`).join(" · ");
  }

  const columns: ColumnsType<AssetRow> = [
    {
      title: "Nom",
      dataIndex: "name",
      render: (name: string, a) => (
        <Flex vertical gap={0}>
          <Text>{name}</Text>
          {shares(a.id) && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {shares(a.id)}
            </Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 170,
      render: (t: string) => <Tag>{TYPE_LABELS[t] ?? t}</Tag>,
    },
    {
      title: "Valeur",
      dataIndex: "valueCents",
      align: "right",
      width: 150,
      render: (cents: number, a) => (
        <Text
          strong
          style={{
            fontVariantNumeric: "tabular-nums",
            color: a.kind === "liability" ? MONEY.expense : undefined,
          }}
        >
          {a.kind === "liability" ? "−" : ""}
          {formatCents(cents)}
        </Text>
      ),
    },
  ];

  const section = (title: string, kind: "asset" | "liability") => {
    const rows = assets.filter((a) => a.kind === kind);
    if (rows.length === 0) return null;
    return (
      <Card title={title} styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" size="small" columns={columns} dataSource={rows} pagination={false} />
      </Card>
    );
  };

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Patrimoine
        </Title>
        <Text type="secondary">Vos actifs et passifs, et votre valeur nette.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title="Valeur nette"
              value={formatCents(netWorth.netCents)}
              valueStyle={{ color: netWorth.netCents >= 0 ? MONEY.income : MONEY.expense }}
            />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card size="small">
            <Statistic title="Actifs" value={formatCents(netWorth.assetsCents)} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card size="small">
            <Statistic
              title="Passifs"
              value={formatCents(netWorth.liabilitiesCents)}
              valueStyle={{ color: MONEY.expense }}
            />
          </Card>
        </Col>
      </Row>

      {breakdown && breakdown.byPerson.length > 0 && (
        <Card size="small" title="Par personne">
          <Row gutter={[16, 16]}>
            {breakdown.byPerson.map((p) => (
              <Col key={p.personId} xs={24} sm={12} lg={8}>
                <Statistic
                  title={p.personName}
                  value={formatCents(p.netCents)}
                  valueStyle={{
                    fontSize: 20,
                    color: p.netCents >= 0 ? MONEY.income : MONEY.expense,
                  }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatCents(p.assetsCents)} d&apos;actifs · {formatCents(p.liabilitiesCents)} de
                  passifs
                </Text>
              </Col>
            ))}
          </Row>
          {breakdown.unattributedNetCents !== 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatCents(breakdown.unattributedNetCents)} ne sont rattachés à personne.
            </Text>
          )}
        </Card>
      )}

      <Card title="Valeur nette dans le temps">
        {history.length === 0 ? (
          <Empty
            description="Aucun relevé de valorisation encore enregistré"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ width: "100%", height: 240, minWidth: 0 }}>
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
                <Tooltip
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

      {section("Actifs", "asset")}
      {section("Passifs", "liability")}
    </Flex>
  );
}
