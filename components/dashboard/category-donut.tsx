"use client";

import { useTheme } from "next-themes";
import { Card, Empty, Flex, Typography, theme } from "antd";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PALETTES, SURFACE, type PaletteName } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { CategoryBreakdownItem } from "@application/stats";

const { Text } = Typography;

/**
 * Where the money went, this period.
 *
 * Capped at seven slices plus "Autres". That is not cosmetic: the categorical
 * ramp is validated for eight slots and no further — a ninth colour would be
 * an unvalidated hue sitting next to eight that were checked, and with a dozen
 * categories the slices become unreadable long before the colours run out.
 *
 * Categories carry a user-chosen colour, but it is deliberately ignored here.
 * Nothing stops two categories being given the same colour in the Rules page,
 * and the validated ramp is the only set with a colour-vision guarantee.
 */
export function CategoryDonut({ items }: { items: CategoryBreakdownItem[] }) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const { token } = theme.useToken();
  const ramp = PALETTES[("bleu" satisfies PaletteName)].series[mode];

  const total = items.reduce((sum, i) => sum + i.totalCents, 0);
  if (total === 0) {
    return (
      <Card title="Répartition des dépenses" style={{ height: "100%" }}>
        <Empty description="Aucune dépense sur la période" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const sorted = [...items].sort((a, b) => b.totalCents - a.totalCents);
  const head = sorted.slice(0, 7);
  const tail = sorted.slice(7);
  const data = [
    ...head.map((i, idx) => ({ name: i.name, value: i.totalCents, fill: ramp[idx] })),
    ...(tail.length
      ? [
          {
            name: `Autres (${tail.length})`,
            value: tail.reduce((s, i) => s + i.totalCents, 0),
            fill: ramp[7],
          },
        ]
      : []),
  ];

  return (
    <Card title="Répartition des dépenses" style={{ height: "100%" }}>
      <Flex gap={20} align="center" wrap>
        <div style={{ width: 180, height: 180, minWidth: 180, flexShrink: 0 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={84}
                // A 2px ring in the surface colour keeps adjacent slices from
                // bleeding into one another.
                stroke={mode === "dark" ? SURFACE.dark : SURFACE.light}
                strokeWidth={2}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [formatCents(Number(v)), String(n)] as [string, string]}
                contentStyle={{
                  background: token.colorBgElevated,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                  color: token.colorText,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* The legend is the accessible channel: every slice is named and
            valued in text, so identity never rests on colour alone. */}
        <Flex vertical gap={6} style={{ flex: 1, minWidth: 200 }}>
          {data.map((d) => (
            <Flex key={d.name} align="center" gap={8} justify="space-between">
              <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <span
                  aria-hidden
                  style={{ width: 10, height: 10, borderRadius: 3, background: d.fill, flexShrink: 0 }}
                />
                <Text ellipsis style={{ fontSize: 13 }}>
                  {d.name}
                </Text>
              </Flex>
              <Text type="secondary" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {formatCents(d.value)} · {Math.round((d.value / total) * 100)}%
              </Text>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </Card>
  );
}
