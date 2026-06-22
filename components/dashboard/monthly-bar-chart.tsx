"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCents, formatCentsCompact, formatMonthLabel } from "@/lib/format";
import type { CategorySeries, StackedMonthlyPoint } from "@/lib/db/stats";

export function MonthlyBarChart({
  data,
  series,
}: {
  data: StackedMonthlyPoint[];
  series: CategorySeries[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Aucune dépense sur la période.
      </div>
    );
  }

  // Convert cents to euros for axis and tooltip
  const chartData = data.map((d) => {
    const out: Record<string, number | string> = { month: d.month };
    for (const s of series) {
      const v = (d[s.name] ?? 0) as number;
      out[s.name] = v / 100;
    }
    return out;
  });

  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.name, { label: s.name, color: s.color }]),
  );

  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart data={chartData} margin={{ left: 12, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(m) => formatMonthLabel(`${m}-01`)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={70}
          tickFormatter={(v) => formatCentsCompact(Number(v) * 100)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatMonthLabel(`${label}-01`)}
              formatter={(value, name) => [formatCents(Number(value) * 100), String(name)]}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Bar key={s.name} dataKey={s.name} stackId="a" fill={s.color} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
