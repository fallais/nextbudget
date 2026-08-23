"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Alert, Card, Flex, Tooltip as AntTooltip, Typography, theme } from "antd";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents, formatCentsCompact, formatDateLong, formatDateShort } from "@shared/format";
import { PALETTES, STATUS } from "@shared/palette";
import type { CashflowProjection } from "@application/projection";

const { Text } = Typography;

/**
 * Does this hold until the end of the month.
 *
 * Everything else on this page looks backwards. This is the one figure that
 * answers the question people open a budget app to ask, and the low point
 * matters more than the last day: an account can finish the month comfortably
 * and still go under on the 27th, which is the day the rejected direct debit
 * and its fee actually happen.
 *
 * What it cannot know, it says. No opening balance means no projection at all
 * rather than a shape drawn from movements; no recurring income found means
 * the line is expenses only, and the card says so instead of quietly
 * forecasting ruin.
 */
export function ProjectionCard({ projection }: { projection: CashflowProjection }) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const { token } = theme.useToken();
  const series = PALETTES.bleu.series[mode][0];

  if (!projection.available) {
    return (
      <Card title="Projection du solde">
        <Text type="secondary">
          Projection indisponible : aucun compte n'a de solde de départ. Indiquez-le dans{" "}
          <Link href="/comptes">Comptes</Link> — sans lui, seul le net des opérations importées
          est connu, et ce n'est pas un solde.
        </Text>
      </Card>
    );
  }

  const goesNegative = projection.low.balanceCents < 0;
  const line = goesNegative ? STATUS.critical : series;
  const points = projection.points.map((p) => ({ ...p, label: formatDateShort(p.date) }));

  return (
    <Card
      title="Projection du solde"
      extra={
        <Text type="secondary" style={{ fontSize: 12 }}>
          jusqu'au {formatDateLong(projection.to)}
        </Text>
      }
    >
      <Flex gap={32} wrap align="flex-start">
        <Flex vertical gap={16} style={{ minWidth: 210 }}>
          <Figure
            label={`Solde au ${formatDateShort(projection.to)}`}
            value={formatCents(projection.endBalanceCents)}
            color={projection.endBalanceCents < 0 ? STATUS.critical : undefined}
            big
          />
          <Figure
            label="Point bas"
            value={formatCents(projection.low.balanceCents)}
            color={goesNegative ? STATUS.critical : undefined}
            foot={`le ${formatDateLong(projection.low.date)}`}
          />
        </Flex>

        <div style={{ flex: "1 1 320px", height: 150, minWidth: 0 }}>
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="projectionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={line} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={line} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: token.colorTextSecondary }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                width={56}
                tick={{ fontSize: 11, fill: token.colorTextSecondary }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCentsCompact(Number(v))}
              />
              {/* Zero is the line that matters here, so it is drawn whether or
                  not the axis would have put a gridline there. */}
              <ReferenceLine y={0} stroke={STATUS.critical} strokeDasharray="3 3" />
              <Tooltip
                formatter={(value) => [formatCents(Number(value)), "Solde projeté"]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="balanceCents"
                stroke={line}
                strokeWidth={2}
                fill="url(#projectionFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Flex>

      <Flex gap={24} wrap style={{ marginTop: 12 }}>
        <AntTooltip title="Vos frais fixes encore attendus d'ici là, à leur date d'échéance.">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Charges à venir <Text strong>{formatCents(-projection.scheduledOutCents)}</Text>
          </Text>
        </AntTooltip>
        <AntTooltip title="Les revenus qui reviennent régulièrement, repérés dans vos relevés.">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Revenus attendus <Text strong>{formatCents(projection.scheduledInCents)}</Text>
          </Text>
        </AntTooltip>
        <AntTooltip title="Le reste de vos dépenses, réparti sur les jours : la médiane des trois derniers mois complets, hors charges déjà comptées.">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Dépenses courantes <Text strong>{formatCents(-projection.discretionaryCents)}</Text>
          </Text>
        </AntTooltip>
        {projection.unanchoredAccounts > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {projection.unanchoredAccounts} compte{projection.unanchoredAccounts > 1 ? "s" : ""}{" "}
            sans solde de départ, non compté
            {projection.unanchoredAccounts > 1 ? "s" : ""}
          </Text>
        )}
      </Flex>

      {!projection.incomeKnown && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="Aucun revenu récurrent repéré dans vos relevés : la projection ne compte que les dépenses. Importez quelques mois de plus et le salaire sera reconnu."
        />
      )}
    </Card>
  );
}

function Figure({
  label,
  value,
  color,
  foot,
  big = false,
}: {
  label: string;
  value: string;
  color?: string;
  foot?: string;
  big?: boolean;
}) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: big ? 30 : 20, fontVariantNumeric: "tabular-nums", color }}>
        {value}
      </Text>
      {foot && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {foot}
        </Text>
      )}
    </Flex>
  );
}
