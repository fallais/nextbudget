import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  href,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean | null };
  href?: string;
  accent?: string;
}) {
  const inner = (
    <Card className={cn("transition-colors", href && "hover:border-primary/50")}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span
            className="inline-flex size-9 items-center justify-center rounded-md"
            style={{
              backgroundColor: accent ? `${accent}1a` : undefined,
              color: accent,
            }}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {(trend || hint) && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {trend && (
                <span
                  className={cn(
                    "font-medium",
                    trend.positive === null
                      ? "text-muted-foreground"
                      : trend.positive
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {trend.value}
                </span>
              )}
              {hint && <span>{hint}</span>}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
