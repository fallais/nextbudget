"use client";

import { useTheme } from "next-themes";
import { Card, Empty, theme } from "antd";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PALETTES } from "@shared/palette";
import { formatCents, formatCentsCompact, formatMonthLabel } from "@shared/format";
import type { BalancePoint } from "@application/stats";

/**
 * Balance over the last twelve months.
 *
 * One series, so no legend — the card title names it. A single hue from the
 * validated ramp, thin 2px stroke, and a recessive grid: the shape is the
 * message and gridlines competing with it would be noise.
 */
export function BalanceChart({ data }: { data: BalancePoint[] }) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const { token } = theme.useToken();
  const line = PALETTES.bleu.series[mode][0];

  if (data.length === 0) {
    return (
      <Card title="Évolution du solde" style={{ height: "100%" }}>
        <Empty description="Pas encore d'historique" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const points = data.map((d) => ({ ...d, label: formatMonthLabel(d.month) }));

  return (
    <Card title="Évolution du solde" style={{ height: "100%" }}>
      <div style={{ width: "100%", height: 220, minWidth: 0 }}>
        <ResponsiveContainer>
          <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line} stopOpacity={0.22} />
                <stop offset="100%" stopColor={line} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={token.colorBorderSecondary} />
            <XAxis
              dataKey="label"
              tick={{ fill: token.colorTextTertiary, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCentsCompact(v)}
              tick={{ fill: token.colorTextTertiary, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              formatter={(v) => [formatCents(Number(v)), "Solde"] as [string, string]}
              contentStyle={{
                background: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                color: token.colorText,
              }}
            />
            <Area
              type="monotone"
              dataKey="balanceCents"
              stroke={line}
              strokeWidth={2}
              fill="url(#balanceFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
