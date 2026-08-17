"use client";

import { useState } from "react";
import { Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents, formatDateShort } from "@shared/format";
import type { Rule } from "@domain/entities";

type Sample = {
  id: number;
  date: string;
  description: string;
  amountCents: number;
};
type TestResult = { matchCount: number; total: number; samples: Sample[] };

export function RuleTest({
  pattern,
  matchType,
  amountCondition = "any",
}: {
  pattern: string;
  matchType: Rule["matchType"];
  amountCondition?: Rule["amountCondition"];
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern, matchType, amountCondition }),
      });
      const data = (await res.json()) as TestResult | { error: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Erreur");
      }
      setResult(data as TestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="size-4" />
          Tester sur les transactions existantes
        </span>
        <Button type="button" size="sm" variant="outline" onClick={runTest} disabled={loading}>
          {loading ? <Loader2 className="size-3 animate-spin" /> : "Tester"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{result.matchCount}</span>{" "}
            transaction{result.matchCount > 1 ? "s" : ""} sur {result.total} correspond
            {result.matchCount > 1 ? "ent" : ""}.
          </p>
          {result.samples.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {result.samples.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{formatDateShort(s.date)}</span>
                  <span className="flex-1 truncate">{s.description}</span>
                  <span className="tabular-nums">{formatCents(s.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
