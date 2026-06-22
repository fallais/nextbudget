"use client";

import { useState } from "react";
import { amortizationSchedule } from "@/lib/db/amortization";
import { formatCents, formatDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type { Asset } from "@/lib/db/entities";

export function AmortizationDetail({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);

  if (asset.principalCents == null || asset.interestRateBps == null || !asset.termMonths) {
    return (
      <p className="text-xs text-muted-foreground">
        Renseignez capital, taux et durée pour voir l&apos;échéancier.
      </p>
    );
  }

  const schedule = amortizationSchedule({
    principalCents: asset.principalCents,
    interestRateBps: asset.interestRateBps,
    termMonths: asset.termMonths,
    monthlyPaymentCents: asset.monthlyPaymentCents,
    startDate: asset.startDate,
  });
  if (schedule.length === 0) {
    return <p className="text-xs text-muted-foreground">Échéancier indisponible.</p>;
  }

  const payment = schedule[0].paymentCents;
  const totalInterest = schedule.reduce((a, r) => a + r.interestCents, 0);
  const last = schedule[schedule.length - 1];

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Mensualité</span>
          <p className="font-medium tabular-nums">{formatCents(payment)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Intérêts totaux</span>
          <p className="font-medium tabular-nums">{formatCents(totalInterest)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Fin</span>
          <p className="font-medium tabular-nums">
            {last.date ? formatDateShort(last.date) : `${schedule.length} mois`}
          </p>
        </div>
      </div>
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
