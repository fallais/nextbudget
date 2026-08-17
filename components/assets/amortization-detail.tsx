"use client";

import { useState } from "react";
import {
  amortizationSchedule,
  summarizeLoan,
  type LoanSummary,
} from "@domain/amortization";
import { formatCents, formatDateShort } from "@shared/format";
import { Button } from "@/components/ui/button";
import type { Asset } from "@domain/entities";

/** Local date, not UTC: an instalment falls on a calendar day, not an instant. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "42 000 € d'intérêts · 6 000 € d'assurance · 1 500 € de frais" */
function costBreakdown(s: LoanSummary): string {
  const parts = [`${formatCents(s.totalInterestCents)} d'intérêts`];
  if (s.totalInsuranceCents > 0) parts.push(`${formatCents(s.totalInsuranceCents)} d'assurance`);
  if (s.feesCents > 0) parts.push(`${formatCents(s.feesCents)} de frais`);
  return parts.join(" · ");
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AmortizationDetail({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);

  if (asset.principalCents == null || asset.interestRateBps == null || !asset.termMonths) {
    return (
      <p className="text-xs text-muted-foreground">
        Renseignez capital, taux et durée pour voir l&apos;échéancier.
      </p>
    );
  }

  const loan = {
    principalCents: asset.principalCents,
    interestRateBps: asset.interestRateBps,
    termMonths: asset.termMonths,
    monthlyPaymentCents: asset.monthlyPaymentCents,
    insuranceMonthlyCents: asset.insuranceMonthlyCents,
    feesCents: asset.feesCents,
    startDate: asset.startDate,
  };
  const schedule = amortizationSchedule(loan);
  const summary = summarizeLoan(loan, todayIso());
  if (schedule.length === 0 || !summary) {
    return <p className="text-xs text-muted-foreground">Échéancier indisponible.</p>;
  }

  const { progress } = summary;
  const paidPct = progress
    ? Math.round((progress.principalPaidCents / asset.principalCents) * 100)
    : null;
  // Flag a drift worth acting on — ignore the cents of rounding.
  const staleBalance =
    progress != null &&
    Math.abs(asset.valueCents - progress.principalRemainingCents) >
      Math.max(10_000, asset.principalCents * 0.01);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Mensualité"
          value={formatCents(summary.monthlyTotalCents)}
          hint={
            summary.totalInsuranceCents > 0
              ? `dont ${formatCents(summary.monthlyTotalCents - summary.monthlyPaymentCents)} d'assurance`
              : undefined
          }
        />
        <Stat
          label="Coût du crédit"
          value={formatCents(summary.totalCostCents)}
          hint={costBreakdown(summary)}
        />
        <Stat
          label="Total remboursé"
          value={formatCents(summary.totalPaidCents)}
          hint={`pour ${formatCents(asset.principalCents)} empruntés`}
        />
        <Stat
          label="Fin"
          value={summary.endDate ? formatDateShort(summary.endDate) : `${summary.termMonths} mois`}
          hint={`${summary.termMonths} mensualités`}
        />
      </div>

      {progress && (
        <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-medium">
              {progress.paidCount} / {summary.termMonths} échéances payées
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatCents(progress.principalRemainingCents)} de capital restant
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={paidPct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Capital remboursé"
          >
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, paidPct ?? 0))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatCents(progress.principalPaidCents)} de capital remboursé ·{" "}
            {formatCents(progress.interestPaidCents)} d&apos;intérêts déjà payés
            {progress.nextDate ? ` · prochaine échéance ${formatDateShort(progress.nextDate)}` : ""}
          </p>
          {/* The balance shown in Patrimoine is typed by hand; the schedule
              knows what it should be by now. Point out a stale figure rather
              than letting the net worth quietly drift. */}
          {staleBalance && (
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Le solde saisi ({formatCents(asset.valueCents)}) diffère de
              l&apos;échéancier ({formatCents(progress.principalRemainingCents)}).
              Mettez-le à jour pour une valeur nette juste.
            </p>
          )}
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Masquer l'échéancier" : "Voir l'échéancier"}
      </Button>
      {open && (
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-right">Capital</th>
                <th className="px-2 py-1 text-right">Intérêts</th>
                <th className="px-2 py-1 text-right">Restant</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((r) => (
                <tr key={r.index} className="border-t">
                  <td className="px-2 py-1">{r.index}</td>
                  <td className="px-2 py-1">{r.date ? formatDateShort(r.date) : "—"}</td>
                  <td className="px-2 py-1 text-right">{formatCents(r.principalCents)}</td>
                  <td className="px-2 py-1 text-right">{formatCents(r.interestCents)}</td>
                  <td className="px-2 py-1 text-right">{formatCents(r.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
