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
import { Checkbox } from "@/components/ui/checkbox";
import { parseAmountToCents } from "@/lib/format";
import {
  TOTAL_BPS,
  evenShares,
  formatBps,
  shareErrorMessage,
  validateShares,
  type ShareInput,
} from "@/lib/shares";
import type { Asset } from "@/lib/db/entities";

export type FormPerson = { id: number; name: string };

/**
 * How ownership is expressed in the form. The two presets cover almost every
 * real case; "custom" exists for the unequal split (one partner put in a
 * bigger deposit), which is common enough that a 50/50-only model would be
 * wrong the first time someone buys together.
 */
type ShareMode = "shared" | "mine" | "custom";

export const ASSET_TYPE_LABELS: Record<Asset["type"], string> = {
  real_estate: "Immobilier",
  vehicle: "Véhicule",
  savings: "Épargne",
  investment: "Investissement",
  loan: "Prêt",
  mortgage: "Crédit immobilier",
  other: "Autre",
};

// Types valid for each nature — a liability can't be "Immobilier", etc.
const ASSET_TYPES: Asset["type"][] = ["real_estate", "vehicle", "savings", "investment", "other"];
const LIABILITY_TYPES: Asset["type"][] = ["mortgage", "loan", "other"];
const typesFor = (k: Asset["kind"]) => (k === "asset" ? ASSET_TYPES : LIABILITY_TYPES);
const defaultTypeFor = (k: Asset["kind"]): Asset["type"] => (k === "asset" ? "savings" : "mortgage");

const centsToInput = (c: number | null | undefined) =>
  c == null ? "" : (c / 100).toFixed(2).replace(".", ",");
const toBps = (s: string) => (s ? Math.round(Number(s.replace(",", ".")) * 100) : null);
const toCents = (s: string) => (s ? Math.abs(parseAmountToCents(s)) : null);

/** Work out which preset an existing set of shares corresponds to. */
function modeForOwners(
  owners: ShareInput[],
  persons: FormPerson[],
  mePersonId: number | null,
): ShareMode {
  if (owners.length === 0) return "mine";
  if (
    owners.length === 1 &&
    owners[0].shareBps === TOTAL_BPS &&
    owners[0].personId === mePersonId
  ) {
    return "mine";
  }
  const even = evenShares(persons.map((p) => p.id));
  const sameSet =
    owners.length === even.length &&
    even.every((e) => owners.some((o) => o.personId === e.personId && o.shareBps === e.shareBps));
  return sameSet ? "shared" : "custom";
}

export function AssetForm({
  open,
  onOpenChange,
  asset,
  accounts,
  persons = [],
  owners = [],
  mePersonId = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: Asset | null;
  accounts: { id: number; name: string }[];
  persons?: FormPerson[];
  owners?: ShareInput[];
  mePersonId?: number | null;
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
  const [insurance, setInsurance] = useState(centsToInput(asset?.insuranceMonthlyCents));
  const [fees, setFees] = useState(centsToInput(asset?.feesCents));
  const [startDate, setStartDate] = useState(asset?.startDate ?? "");
  const [accountId, setAccountId] = useState<string>(asset?.accountId ? String(asset.accountId) : "none");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [addCredit, setAddCredit] = useState(false);
  const [creditName, setCreditName] = useState("");
  const [loading, setLoading] = useState(false);

  // Ownership. Only surfaced once the household has more than one member —
  // a solo install keeps the old implicit "it's all mine" behaviour.
  const showShares = persons.length > 1;
  const [shareMode, setShareMode] = useState<ShareMode>(() =>
    modeForOwners(owners, persons, mePersonId),
  );
  // Percentages as typed, keyed by person id, e.g. { 1: "60", 2: "40" }.
  const [customPct, setCustomPct] = useState<Record<number, string>>(() => {
    const initial = owners.length > 0 ? owners : evenShares(persons.map((p) => p.id));
    return Object.fromEntries(
      persons.map((p) => {
        const bps = initial.find((o) => o.personId === p.id)?.shareBps ?? 0;
        return [p.id, String(bps / 100).replace(".", ",")];
      }),
    );
  });

  function ownersPayload(): ShareInput[] | undefined {
    if (!showShares) return undefined;
    if (shareMode === "shared") return evenShares(persons.map((p) => p.id));
    if (shareMode === "mine") {
      return mePersonId != null ? [{ personId: mePersonId, shareBps: TOTAL_BPS }] : undefined;
    }
    return persons
      .map((p) => ({
        personId: p.id,
        shareBps: Math.round(Number((customPct[p.id] ?? "0").replace(",", ".")) * 100),
      }))
      .filter((o) => Number.isFinite(o.shareBps) && o.shareBps > 0);
  }

  const customTotalBps = persons.reduce(
    (sum, p) => sum + Math.round(Number((customPct[p.id] ?? "0").replace(",", ".")) * 100 || 0),
    0,
  );

  // Base UI's <SelectValue/> shows the raw value unless the root gets an items map.
  const kindItems: Record<string, string> = { asset: "Actif", liability: "Passif" };
  const accountItems: Record<string, string> = {
    none: "Aucun",
    ...Object.fromEntries(accounts.map((a) => [String(a.id), a.name])),
  };

  // A liability of type loan/mortgage carries the loan fields directly.
  const isLoan = kind === "liability" && (type === "loan" || type === "mortgage");
  // When adding real estate, offer to also record the mortgage that funds it.
  const offerCredit = !editing && kind === "asset" && type === "real_estate";

  function changeKind(k: Asset["kind"]) {
    setKind(k);
    if (!typesFor(k).includes(type)) setType(defaultTypeFor(k));
    if (k !== "asset") setAddCredit(false);
  }

  const loanFields = (
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
      <div className="space-y-2">
        <Label htmlFor="asset-insurance">Assurance (€/mois)</Label>
        <Input id="asset-insurance" inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="0,00" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-fees">Frais de dossier (€)</Label>
        <Input id="asset-fees" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0,00" />
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="asset-start">Date de début</Label>
        <Input id="asset-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        L&apos;assurance et les frais (dossier, garantie, courtier) comptent dans le
        coût du crédit — sur un prêt immobilier, l&apos;assurance en représente
        souvent une bonne part.
      </p>
    </div>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let valueCents: number;
    try {
      valueCents = Math.abs(parseAmountToCents(value || "0"));
    } catch {
      toast.error("Montant invalide");
      return;
    }
    const owners = ownersPayload();
    if (owners) {
      const invalid = validateShares(owners);
      if (invalid) {
        toast.error(shareErrorMessage(invalid));
        return;
      }
    }

    const body: Record<string, unknown> = {
      name,
      kind,
      type,
      valueCents,
      accountId: accountId === "none" ? null : Number(accountId),
      notes: notes || null,
      ...(owners ? { owners } : {}),
    };
    if (isLoan) {
      body.principalCents = toCents(principal);
      body.interestRateBps = toBps(rate);
      body.termMonths = term ? Number(term) : null;
      body.monthlyPaymentCents = toCents(monthly);
      body.insuranceMonthlyCents = toCents(insurance);
      body.feesCents = toCents(fees);
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

      // Real-estate → optionally create the associated mortgage as a liability.
      if (offerCredit && addCredit) {
        const principalCents = toCents(principal);
        const created = (await res.json().catch(() => null)) as { id?: number } | null;
        await fetch("/api/assets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: creditName.trim() || `Crédit ${name}`,
            kind: "liability",
            type: "mortgage",
            valueCents: principalCents ?? 0, // outstanding balance ≈ capital initially
            principalCents,
            interestRateBps: toBps(rate),
            termMonths: term ? Number(term) : null,
            monthlyPaymentCents: toCents(monthly),
            insuranceMonthlyCents: toCents(insurance),
            feesCents: toCents(fees),
            startDate: startDate || null,
            // The loan is tied to the property it funds, and by default is
            // owned in the same proportions. Both are editable afterwards:
            // a 50/50 house can be paid for by an unequally split loan.
            linkedAssetId: created?.id ?? null,
            ...(owners ? { owners } : {}),
          }),
        });
      }

      toast.success(editing ? "Modifié" : addCredit ? "Bien et crédit ajoutés" : "Ajouté");
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
              <Select value={kind} items={kindItems} onValueChange={(v) => v && changeKind(v as Asset["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Actif</SelectItem>
                  <SelectItem value="liability">Passif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} items={ASSET_TYPE_LABELS} onValueChange={(v) => v && setType(v as Asset["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typesFor(kind).map((t) => (
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
              {loanFields}
            </div>
          )}

          {offerCredit && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={addCredit} onCheckedChange={(v) => setAddCredit(v === true)} />
                Ajouter le crédit immobilier associé
              </label>
              {addCredit && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="credit-name">Nom du crédit</Label>
                    <Input
                      id="credit-name"
                      value={creditName}
                      onChange={(e) => setCreditName(e.target.value)}
                      placeholder={name ? `Crédit ${name}` : "Crédit immobilier"}
                    />
                  </div>
                  {loanFields}
                </div>
              )}
            </div>
          )}

          {showShares && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="space-y-2">
                <Label>Propriété</Label>
                <Select
                  value={shareMode}
                  items={{
                    shared: "Commun, à parts égales",
                    mine: "À moi",
                    custom: "Personnalisé…",
                  }}
                  onValueChange={(v) => v && setShareMode(v as ShareMode)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Commun, à parts égales</SelectItem>
                    <SelectItem value="mine">À moi</SelectItem>
                    <SelectItem value="custom">Personnalisé…</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {shareMode === "shared" && (
                <p className="text-xs text-muted-foreground">
                  {evenShares(persons.map((p) => p.id))
                    .map((s) => {
                      const who = persons.find((p) => p.id === s.personId);
                      return `${who?.name ?? "—"} ${formatBps(s.shareBps)}`;
                    })
                    .join(" · ")}
                </p>
              )}

              {shareMode === "mine" && mePersonId == null && (
                <p className="text-xs text-destructive">
                  Aucune personne ne correspond à votre compte. Rattachez-la depuis
                  la page Apports pour utiliser cette option.
                </p>
              )}

              {shareMode === "custom" && (
                <div className="space-y-2">
                  {persons.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm">{p.name}</span>
                      <Input
                        inputMode="decimal"
                        className="w-20"
                        value={customPct[p.id] ?? ""}
                        onChange={(e) =>
                          setCustomPct((c) => ({ ...c, [p.id]: e.target.value }))
                        }
                        aria-label={`Quote-part de ${p.name} en pourcent`}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  ))}
                  <p
                    className={
                      customTotalBps === TOTAL_BPS
                        ? "text-xs text-muted-foreground"
                        : "text-xs text-destructive"
                    }
                  >
                    Total : {formatBps(customTotalBps)}
                    {customTotalBps === TOTAL_BPS ? "" : " — doit faire 100 %"}
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Qui possède ce bien, et dans quelle proportion. Indépendant de
                qui le paie et de qui peut le voir.
              </p>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Compte lié (optionnel)</Label>
              <Select value={accountId} items={accountItems} onValueChange={(v) => v && setAccountId(v)}>
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
