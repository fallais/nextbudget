"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { formatCents, formatCentsCompact, formatDateShort } from "@shared/format";
import type { NetWorthPoint } from "@application/assets";

const config = {
  net: { label: "Valeur nette", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function snapshot() {
    setLoading(true);
    try {
      const res = await fetch("/api/assets/snapshot", { method: "POST" });
      if (!res.ok) {
        toast.error("Échec de l'enregistrement");
        return;
      }
      toast.success("Instantané enregistré");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const chartData = data.map((p) => ({ date: p.date, net: p.netCents / 100 }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Valeur nette dans le temps</h3>
        <Button variant="outline" size="sm" onClick={() => void snapshot()} disabled={loading}>
          {loading ? "…" : "Enregistrer un instantané"}
        </Button>
      </div>
      {chartData.length < 2 ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Enregistrez des instantanés au fil du temps pour suivre l&apos;évolution.
        </div>
      ) : (
        <ChartContainer config={config} className="h-64 w-full">
          <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(d) => formatDateShort(d)}
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
                  labelFormatter={(label) => formatDateShort(String(label))}
                  formatter={(value) => formatCents(Number(value) * 100)}
                />
              }
            />
            <Area type="monotone" dataKey="net" stroke="var(--chart-1)" fill="url(#netWorthFill)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
