"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCents } from "@/lib/format";
import type { CategoryBreakdownItem } from "@/lib/db/stats";

export function CategoryDonut({ data }: { data: CategoryBreakdownItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Aucune dépense sur la période.
      </div>
    );
  }
  const chartData = data.map((d) => ({
    name: d.name,
    value: d.totalCents / 100,
    color: d.color,
  }));
  const total = data.reduce((a, d) => a + d.totalCents, 0);
  const config: ChartConfig = Object.fromEntries(
    chartData.map((d) => [d.name, { label: d.name, color: d.color }]),
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr] md:items-center">
      <ChartContainer config={config} className="h-56 w-full">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => [formatCents(Number(value) * 100), String(name)]}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={2}
          >
            {chartData.map((d) => (
              <Cell key={d.name} fill={d.color} stroke="var(--background)" />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-1.5 text-sm">
        {data.slice(0, 8).map((d) => {
          const pct = total === 0 ? 0 : (d.totalCents / total) * 100;
          return (
            <li key={`${d.id ?? "uncat"}-${d.name}`} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: d.color }}
              />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatCents(d.totalCents)}
              </span>
              <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                {pct.toFixed(0)} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
