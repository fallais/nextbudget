"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button, Card, Empty, Flex, Table, Tag, Tooltip as AntTooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { formatCents, formatCentsCompact, formatMonthLabel } from "@shared/format";
import { PALETTES, STATUS } from "@shared/palette";
import type { FixedExpenseTrend, FixedExpensesTrendSummary } from "@application/fixed-expenses";

const { Text } = Typography;

/**
 * What your fixed charges have done to you over two years.
 *
 * The page the frais fixes list cannot be: that one answers "was it paid this
 * month", which is a checklist, and this one answers "is it costing more than
 * it did", which is the question that changes behaviour. The water going from
 * 42 to 51 euros a quarter never shows up as a problem month by month; it
 * shows up here, or not at all.
 *
 * Every comparison is a rolling year against the year before. Last month
 * against the same month last year would call a quarterly bill a 100 % rise
 * whenever it lands in one month and not the other, and would report the rent
 * doubling in a month it happened to be taken twice.
 */
export function TrendsView({
  trends,
  summary,
}: {
  trends: FixedExpenseTrend[];
  summary: FixedExpensesTrendSummary;
}) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const line = PALETTES.bleu.series[mode][0];

  const rows = [...trends].sort((a, b) => b.monthlyCents - a.monthlyCents);
  const changeCents = summary.recentCents - summary.previousCents;

  const columns: ColumnsType<FixedExpenseTrend> = [
    {
      title: "Charge",
      dataIndex: ["fixedExpense", "name"],
      render: (_, t) => (
        <Flex vertical gap={2}>
          <Flex gap={8} align="center" wrap>
            <Text strong>{t.fixedExpense.name}</Text>
            {t.drift && (
              <AntTooltip
                title={`${formatCents(t.drift.fromCents)} → ${formatCents(t.drift.toCents)}, à partir de ${formatMonthLabel(t.drift.since.slice(0, 7))}`}
              >
                <Tag
                  color={t.drift.changePct > 0 ? STATUS.critical : STATUS.good}
                  style={{ marginInlineEnd: 0 }}
                >
                  {t.drift.changePct > 0 ? "+" : ""}
                  {t.drift.changePct.toFixed(0)} % par prélèvement
                </Tag>
              </AntTooltip>
            )}
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t.category?.name ?? "Sans catégorie"} · {t.occurrences} prélèvement
            {t.occurrences > 1 ? "s" : ""} sur deux ans
          </Text>
        </Flex>
      ),
    },
    {
      title: "Par mois",
      dataIndex: "monthlyCents",
      align: "right",
      width: 120,
      render: (cents: number) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(cents)}</Text>
      ),
    },
    {
      title: "Sur 12 mois",
      align: "right",
      width: 130,
      responsive: ["lg"],
      render: (_, t) => (
        <Text type="secondary" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(t.yearOnYear?.recentCents ?? t.monthlyCents * 12)}
        </Text>
      ),
    },
    {
      title: "Sur un an",
      align: "right",
      width: 150,
      render: (_, t) =>
        t.yearOnYear ? (
          <Flex vertical gap={0} align="flex-end">
            <Text
              strong
              style={{
                fontVariantNumeric: "tabular-nums",
                color: t.yearOnYear.changePct > 0 ? STATUS.critical : STATUS.good,
              }}
            >
              {t.yearOnYear.changePct > 0 ? "+" : ""}
              {t.yearOnYear.changePct.toFixed(1)} %
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatCents(t.yearOnYear.previousCents)} → {formatCents(t.yearOnYear.recentCents)}
            </Text>
          </Flex>
        ) : (
          // Not "0 %": a charge that started this year has not held steady,
          // there is simply nothing to compare it against yet.
          <AntTooltip title="Moins de deux ans d'historique">
            <Text type="secondary">—</Text>
          </AntTooltip>
        ),
    },
    {
      title: "Évolution",
      key: "spark",
      width: 180,
      responsive: ["xl"],
      render: (_, t) => <Spark data={t.series} color={line} />,
    },
  ];

  if (trends.length === 0) {
    return (
      <Flex vertical gap={16}>
        <Header />
        <Card>
          <Empty
            description="Aucune charge fixe suivie : rien à comparer"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Link href="/frais-fixes">
              <Button type="primary">Retour aux frais fixes</Button>
            </Link>
          </Empty>
        </Card>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Header />

      <Card>
        <Flex gap={40} wrap align="flex-start">
          <Flex vertical gap={1}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ces charges, sur les 12 derniers mois
            </Text>
            <Text strong style={{ fontSize: 30, fontVariantNumeric: "tabular-nums" }}>
              {formatCents(summary.recentCents)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              contre {formatCents(summary.previousCents)} les 12 mois précédents
            </Text>
          </Flex>

          {summary.changePct !== null && (
            <Flex vertical gap={1}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Variation
              </Text>
              <Text
                strong
                style={{
                  fontSize: 30,
                  fontVariantNumeric: "tabular-nums",
                  color: summary.changePct > 0 ? STATUS.critical : STATUS.good,
                }}
              >
                {summary.changePct > 0 ? "+" : ""}
                {summary.changePct.toFixed(1)} %
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {changeCents > 0 ? "+" : ""}
                {formatCents(changeCents)} sur l'année
              </Text>
            </Flex>
          )}

          {summary.steepest && (
            <Flex vertical gap={1} style={{ maxWidth: 320 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                La plus forte hausse
              </Text>
              <Text strong style={{ fontSize: 18 }}>
                {summary.steepest.name}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatCents(summary.steepest.changeCents)} de plus sur l'année, soit{" "}
                {summary.steepest.changePct > 0 ? "+" : ""}
                {summary.steepest.changePct.toFixed(0)} %.
              </Text>
            </Flex>
          )}
        </Flex>

        {summary.changePct === null && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            La comparaison annuelle demande deux ans de relevés. Elle apparaîtra dès que vos
            charges auront deux exercices complets derrière elles.
          </Text>
        )}
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table rowKey={(t) => t.fixedExpense.id} size="small" columns={columns} dataSource={rows} pagination={false} />
      </Card>
    </Flex>
  );
}

function Header() {
  return (
    <PageHeader
      crumbs={[{ label: "Frais fixes", href: "/frais-fixes" }, { label: "Évolution" }]}
      description="Ce que chaque charge coûte aujourd'hui comparé à l'an dernier, sur 24 mois de relevés. Seules les charges suivies apparaissent ici."
    />
  );
}

/**
 * Two years in 180 pixels.
 *
 * No axes: the shape is the message, and a scale would not fit anywhere it
 * could be read. The figures next to it are the precise version, so this only
 * has to answer "steady, climbing, or one-off".
 */
function Spark({ data, color }: { data: { month: string; paidCents: number }[]; color: string }) {
  return (
    <div style={{ width: "100%", height: 40, minWidth: 0 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          {/* Hidden, but declared: without it the tooltip labels each point
              with its index instead of the month it belongs to. */}
          <XAxis dataKey="month" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1 }}
            formatter={(value) => [formatCentsCompact(Number(value)), "Payé"]}
            labelFormatter={(label) => formatMonthLabel(String(label))}
          />
          <Area
            type="monotone"
            dataKey="paidCents"
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.14}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
