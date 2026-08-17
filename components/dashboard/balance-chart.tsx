"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCentsCompact, formatMonthLabel, formatCents } from "@shared/format";
import type { BalancePoint } from "@application/stats";

const config = {
  balance: { label: "Solde cumulé", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function BalanceChart({ data }: { data: BalancePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Pas assez de données pour afficher la courbe.
      </div>
    );
  }

  const chartData = data.map((p) => ({
    month: p.month,
    balance: p.balanceCents / 100,
  }));

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
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
          tickFormatter={(v) => formatCentsCompact(v * 100)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatMonthLabel(`${label}-01`)}
              formatter={(value) => formatCents(Number(value) * 100)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--chart-1)"
          fill="url(#balanceFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
