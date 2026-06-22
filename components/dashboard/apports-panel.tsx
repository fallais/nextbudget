import Link from "next/link";
import { ArrowRight, Users2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PersonWithStatus } from "@/lib/db/contributions";

export function ApportsPanel({ perPerson }: { perPerson: PersonWithStatus[] }) {
  const active = perPerson.filter(
    (p) => p.person.isActive && p.contributions.length > 0,
  );
  if (active.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apports du mois</CardTitle>
          <CardDescription>
            Aucun apport configuré.{" "}
            <Link href="/apports" className="text-primary hover:underline">
              Configurer →
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalExpected = active.reduce((a, p) => a + p.expectedTotalCents, 0);
  const totalReceived = active.reduce((a, p) => a + p.receivedTotalCents, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Users2 className="size-4" />
            Apports du mois
          </CardTitle>
          <CardDescription>
            {formatCents(totalReceived)} reçus sur {formatCents(totalExpected)} attendus
          </CardDescription>
        </div>
        <Link
          href="/apports"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Détails <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.map((p) => {
          const ratio =
            p.expectedTotalCents === 0
              ? 0
              : p.receivedTotalCents / p.expectedTotalCents;
          const pct = Math.min(100, Math.round(ratio * 100));
          const barColor =
            ratio >= 1
              ? "bg-emerald-600"
              : ratio >= 0.8
                ? "bg-amber-500"
                : "bg-rose-600";
          return (
            <div key={p.person.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {p.person.name}
                  {p.isConsolidated && (
                    <Sparkles
                      className="size-3 text-amber-600 dark:text-amber-400"
                      aria-label="Apport consolidé détecté"
                    />
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCents(p.receivedTotalCents)} / {formatCents(p.expectedTotalCents)}
                  <span className="ml-2 text-xs">{pct} %</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
