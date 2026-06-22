"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseAmountToCents } from "@/lib/format";
import type { Asset } from "@/lib/db/entities";

export const ASSET_TYPE_LABELS: Record<Asset["type"], string> = {
  real_estate: "Immobilier",
  vehicle: "Véhicule",
  savings: "Épargne",
  investment: "Investissement",
  loan: "Prêt",
  mortgage: "Crédit immobilier",
  other: "Autre",
};

const centsToInput = (c: number | null | undefined) =>
  c == null ? "" : (c / 100).toFixed(2).replace(".", ",");

export function AssetForm({
  open,
  onOpenChange,
  asset,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: Asset | null;
  accounts: { id: number; name: string }[];
}) {
  const router = useRouter();
  const editing = !!asset;
  const [kind, setKind] = useState<Asset["kind"]>(asset?.kind ?? "asset");
  const [type, setType] = useState<Asset["type"]>(asset?.type ?? "savings");
  const [name, setName] = useState(asset?.name ?? "");
  const [value, setValue] = useState(centsToInput(asset?.valueCents));
  const [principal, setPrincipal] = useState(centsToInput(asset?.principalCents));
  const [rate, setRate] = useState(
    asset?.interestRateBps != null ? (asset.interestRateBps / 100).toString().replace(".", ",") : "",
  );
  const [term, setTerm] = useState(asset?.termMonths != null ? String(asset.termMonths) : "");
  const [monthly, setMonthly] = useState(centsToInput(asset?.monthlyPaymentCents));
  const [startDate, setStartDate] = useState(asset?.startDate ?? "");
  const [accountId, setAccountId] = useState<string>(asset?.accountId ? String(asset.accountId) : "none");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [loading, setLoading] = useState(false);

  const isLoan = type === "loan" || type === "mortgage";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let valueCents: number;
    try {
      valueCents = Math.abs(parseAmountToCents(value || "0"));
    } catch {
      toast.error("Montant invalide");
      return;
    }
    const body: Record<string, unknown> = {
      name,
      kind,
      type,
      valueCents,
      accountId: accountId === "none" ? null : Number(accountId),
      notes: notes || null,
    };
    if (isLoan) {
      body.principalCents = principal ? Math.abs(parseAmountToCents(principal)) : null;
      body.interestRateBps = rate ? Math.round(Number(rate.replace(",", ".")) * 100) : null;
      body.termMonths = term ? Number(term) : null;
      body.monthlyPaymentCents = monthly ? Math.abs(parseAmountToCents(monthly)) : null;
      body.startDate = startDate || null;
    }

    setLoading(true);
    try {
      const res = await fetch(editing ? `/api/assets/${asset!.id}` : "/api/assets", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      toast.success(editing ? "Modifié" : "Ajouté");
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier" : "Ajouter"} un élément</DialogTitle>
          <DialogDescription>
            Un actif (épargne, immobilier…) ou un passif (crédit, prêt).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nature</Label>
              <Select value={kind} onValueChange={(v) => v && setKind(v as Asset["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Actif</SelectItem>
                  <SelectItem value="liability">Passif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as Asset["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ASSET_TYPE_LABELS) as Asset["type"][]).map((t) => (
                    <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-name">Nom</Label>
            <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-value">
              {kind === "liability" ? "Solde restant dû (€)" : "Valeur (€)"}
            </Label>
            <Input
              id="asset-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          {isLoan && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Détails du prêt</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="asset-principal">Capital emprunté (€)</Label>
                  <Input id="asset-principal" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-rate">Taux annuel (%)</Label>
                  <Input id="asset-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1,90" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-term">Durée (mois)</Label>
                  <Input id="asset-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="240" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-monthly">Mensualité (€)</Label>
                  <Input id="asset-monthly" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="auto" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="asset-start">Date de début</Label>
                  <Input id="asset-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Compte lié (optionnel)</Label>
              <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="asset-notes">Notes</Label>
            <Textarea id="asset-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
