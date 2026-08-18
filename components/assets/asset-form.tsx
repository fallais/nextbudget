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
import { parseAmountToCents } from "@shared/format";
import {
  Ownership,
  TOTAL_BPS,
  formatBps,
  type OwnerShareRow,
} from "@domain/value-objects/share";
import { isDomainError } from "@domain/errors";
import {
  deferralMonthsBetween,
  impliedTaegBps,
  monthlyPaymentCents,
  summarizeLoan,
} from "@domain/services/amortization";
import { formatCents } from "@shared/format";
import { cn } from "@shared/utils";
import type { AssetRow } from "@domain/entities";
import type { AssetOwnerInput } from "@domain/repositories";

export type FormPerson = { id: number; name: string };

/**
 * How ownership is expressed in the form. The two presets cover almost every
 * real case; "custom" exists for the unequal split (one partner put in a
 * bigger deposit), which is common enough that a 50/50-only model would be
 * wrong the first time someone buys together.
 */
type ShareMode = "shared" | "mine" | "custom";

export const ASSET_TYPE_LABELS: Record<AssetRow["type"], string> = {
  real_estate: "Immobilier",
  vehicle: "Véhicule",
  savings: "Épargne",
  investment: "Investissement",
  loan: "Prêt",
  mortgage: "Crédit immobilier",
  other: "Autre",
};

// Types valid for each nature — a liability can't be "Immobilier", etc.
const ASSET_TYPES: AssetRow["type"][] = ["real_estate", "vehicle", "savings", "investment", "other"];
const LIABILITY_TYPES: AssetRow["type"][] = ["mortgage", "loan", "other"];
const typesFor = (k: AssetRow["kind"]) => (k === "asset" ? ASSET_TYPES : LIABILITY_TYPES);
const defaultTypeFor = (k: AssetRow["kind"]): AssetRow["type"] => (k === "asset" ? "savings" : "mortgage");

/** Local date, not UTC: an instalment falls on a calendar day, not an instant. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const centsToInput = (c: number | null | undefined) =>
  c == null ? "" : (c / 100).toFixed(2).replace(".", ",");
const toBps = (s: string) => (s ? Math.round(Number(s.replace(",", ".")) * 100) : null);
const toCents = (s: string) => (s ? Math.abs(parseAmountToCents(s)) : null);

/** Work out which preset an existing set of shares corresponds to. */
function modeForOwners(
  owners: OwnerShareRow[],
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
  const even = Ownership.even(persons.map((p) => p.id)).toRows();
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
  defaultKind = "asset",
  lockKind = false,
  linkableAssets = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: AssetRow | null;
  accounts: { id: number; name: string }[];
  persons?: FormPerson[];
  owners?: AssetOwnerInput[];
  mePersonId?: number | null;
  /** What a *new* entry starts as. The Credits page opens straight on a loan. */
  defaultKind?: AssetRow["kind"];
  /**
   * Hide the actif/passif choice. On the Credits page there is nothing to
   * choose: a credit is a liability, and offering the alternative only invites
   * creating an asset from the wrong screen.
   */
  lockKind?: boolean;
  /** Assets a loan can be attached to. Enables the "Finance" picker. */
  linkableAssets?: { id: number; name: string }[];
}) {
  const router = useRouter();
  const editing = !!asset;
  const [kind, setKind] = useState<AssetRow["kind"]>(asset?.kind ?? defaultKind);
  const [type, setType] = useState<AssetRow["type"]>(asset?.type ?? defaultTypeFor(defaultKind));
  const [name, setName] = useState(asset?.name ?? "");
  const [value, setValue] = useState(centsToInput(asset?.valueCents));
  const [principal, setPrincipal] = useState(centsToInput(asset?.principalCents));
  const [rate, setRate] = useState(
    asset?.interestRateBps != null ? (asset.interestRateBps / 100).toString().replace(".", ",") : "",
  );
  const [taeg, setTaeg] = useState(
    asset?.taegBps != null ? (asset.taegBps / 100).toString().replace(".", ",") : "",
  );
  const [term, setTerm] = useState(asset?.termMonths != null ? String(asset.termMonths) : "");
  const [monthly, setMonthly] = useState(centsToInput(asset?.monthlyPaymentCents));
  const [insurance, setInsurance] = useState(centsToInput(asset?.insuranceMonthlyCents));
  const [fees, setFees] = useState(centsToInput(asset?.feesCents));
  const [signatureDate, setSignatureDate] = useState(asset?.signatureDate ?? "");
  const [linkedAssetId, setLinkedAssetId] = useState<string>(
    asset?.linkedAssetId ? String(asset.linkedAssetId) : "none",
  );
  const [startDate, setStartDate] = useState(asset?.startDate ?? "");
  /** Per-borrower premiums as typed, keyed by person id: { 1: "18,40" }. */
  const [borrowerInsurance, setBorrowerInsurance] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      owners
        .filter((o) => o.insuranceMonthlyCents != null)
        .map((o) => [o.personId, centsToInput(o.insuranceMonthlyCents)]),
    ),
  );
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
    const initial =
      owners.length > 0 ? owners : Ownership.even(persons.map((p) => p.id)).toRows();
    return Object.fromEntries(
      persons.map((p) => {
        const bps = initial.find((o) => o.personId === p.id)?.shareBps ?? 0;
        return [p.id, String(bps / 100).replace(".", ",")];
      }),
    );
  });

  function ownersPayload(): AssetOwnerInput[] | undefined {
    if (!showShares) return undefined;
    const shares: OwnerShareRow[] | undefined =
      shareMode === "shared"
        ? Ownership.even(persons.map((p) => p.id)).toRows()
        : shareMode === "mine"
          ? mePersonId != null
            ? [{ personId: mePersonId, shareBps: TOTAL_BPS }]
            : undefined
          : persons
              .map((p) => ({
                personId: p.id,
                shareBps: Math.round(Number((customPct[p.id] ?? "0").replace(",", ".")) * 100),
              }))
              .filter((o) => Number.isFinite(o.shareBps) && o.shareBps > 0);

    if (!shares) return undefined;
    // Each borrower's own premium rides along with their share. Left null when
    // the loan is not split per head, so the loan-level figure keeps applying.
    return shares.map((s) => ({
      ...s,
      insuranceMonthlyCents: splitInsurance ? (toCents(borrowerInsurance[s.personId] ?? "") ?? null) : null,
    }));
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
  const linkedAssetItems: Record<string, string> = {
    none: "Aucun bien",
    ...Object.fromEntries(linkableAssets.map((a) => [String(a.id), a.name])),
  };

  // A liability of type loan/mortgage carries the loan fields directly.
  const isLoan = kind === "liability" && (type === "loan" || type === "mortgage");
  // When adding real estate, offer to also record the mortgage that funds it.
  const offerCredit = !editing && kind === "asset" && type === "real_estate";

  /**
   * The outstanding balance of a dated loan is not an opinion — the schedule
   * says exactly how much capital each instalment has retired. Once capital,
   * rate, term and start date are in, the field stops being editable and shows
   * the derived figure instead, because a hand-typed balance is wrong from the
   * month after it is entered and drags net worth with it.
   */
  const derivedBalanceCents: number | null = (() => {
    if (!isLoan) return null;
    const principalCents = toCents(principal);
    const rateBps = toBps(rate);
    const months = term ? Number(term) : null;
    if (principalCents == null || rateBps == null || !months || !startDate) return null;
    const summary = summarizeLoan(
      {
        principalCents,
        interestRateBps: rateBps,
        termMonths: months,
        monthlyPaymentCents: toCents(monthly),
        insuranceMonthlyCents: toCents(insurance),
        feesCents: toCents(fees),
        startDate,
      },
      todayIso(),
    );
    return summary?.progress?.principalRemainingCents ?? principalCents;
  })();
  const balanceIsDerived = derivedBalanceCents !== null;

  /**
   * A shared loan gets one premium per borrower rather than a single figure.
   * Assurance emprunteur is quoted per head — different ages, different health,
   * different quotités — so one number could not say whose it is.
   */
  const splitInsurance = isLoan && persons.length > 1;
  const perBorrowerTotalCents = persons.reduce(
    (total, p) => total + (toCents(borrowerInsurance[p.id] ?? "") ?? 0),
    0,
  );
  const deferralMonths = deferralMonthsBetween(signatureDate || null, startDate || null);

  /**
   * What capital, rate and term imply, shown beside the mensualité field.
   *
   * The usual entry error is typing the TAEG into the rate box: it silently
   * inflates every instalment, and without this you would only notice much
   * later, comparing the schedule against a bank statement.
   */
  const computedPaymentCents: number | null = (() => {
    const p = toCents(principal);
    const b = toBps(rate);
    const n = term ? Number(term) : null;
    if (!isLoan || p == null || b == null || !n) return null;
    return monthlyPaymentCents(p, b, n);
  })();

  /**
   * Compare the TAEG on the offer against the one these terms imply.
   *
   * A quarter of a point of tolerance: the TAEG is rounded on the offer, and
   * lenders differ slightly on which ancillary costs they fold in. Beyond that
   * the numbers genuinely disagree and something was mistyped — most often the
   * TAEG sitting in the taux nominal field.
   */
  const taegCheck: { ok: boolean; impliedLabel: string } | null = (() => {
    const stated = toBps(taeg);
    const p = toCents(principal);
    const b = toBps(rate);
    const n = term ? Number(term) : null;
    if (!isLoan || stated == null || p == null || b == null || !n) return null;

    const implied = impliedTaegBps({
      principalCents: p,
      interestRateBps: b,
      termMonths: n,
      monthlyPaymentCents: toCents(monthly),
      insuranceMonthlyCents: splitInsurance ? perBorrowerTotalCents : toCents(insurance),
      feesCents: toCents(fees),
    });
    if (implied == null) return null;
    return {
      ok: Math.abs(implied - stated) <= 25,
      impliedLabel: `${(implied / 100).toFixed(2).replace(".", ",")} %`,
    };
  })();

  function changeKind(k: AssetRow["kind"]) {
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
        <Label htmlFor="asset-rate">Taux nominal (%)</Label>
        <Input id="asset-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1,31" />
        {/* The TAEG is the nominal rate plus insurance and fees, so entering it
            here would double-count them and overstate every instalment. */}
        <p className="text-xs text-muted-foreground">
          Pas le TAEG — celui-ci inclut déjà assurance et frais.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-taeg">TAEG (%)</Label>
        <Input id="asset-taeg" inputMode="decimal" value={taeg} onChange={(e) => setTaeg(e.target.value)} placeholder="1,66" />
        {/* Purely a cross-check. The TAEG never feeds the schedule — it already
            contains the insurance and fees, so amortizing with it would count
            them twice. Comparing it against what the terms imply is what
            catches the two rates being swapped. */}
        {taegCheck && (
          <p className={cn("text-xs", taegCheck.ok ? "text-muted-foreground" : "text-amber-700 dark:text-amber-500")}>
            {taegCheck.ok
              ? `Cohérent avec vos conditions (${taegCheck.impliedLabel} calculé).`
              : `Vos conditions impliquent ${taegCheck.impliedLabel} — vérifiez le taux nominal, l'assurance ou les frais.`}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-term">Durée (mois)</Label>
        <Input id="asset-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="240" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-monthly">Mensualité (€)</Label>
        <Input id="asset-monthly" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="auto" />
        {/* Shown live so a mismatch with the contract is caught at entry
            rather than discovered later in the schedule — the usual cause is
            the TAEG typed into the rate field. */}
        {computedPaymentCents !== null && (
          <p className="text-xs text-muted-foreground">
            Calculée : {formatCents(computedPaymentCents)}
            {toCents(monthly) != null && toCents(monthly) !== computedPaymentCents && (
              <span className="text-amber-700 dark:text-amber-500">
                {" "}
                — ne correspond pas à votre saisie
              </span>
            )}
          </p>
        )}
      </div>
      {/* One premium for the whole loan. When the loan is shared, the
          per-borrower fields below take over — see `perBorrowerInsurance`. */}
      {!splitInsurance && (
        <div className="space-y-2">
          <Label htmlFor="asset-insurance">Assurance (€/mois)</Label>
          <Input id="asset-insurance" inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="0,00" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="asset-fees">Frais de dossier (€)</Label>
        <Input id="asset-fees" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0,00" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-signature">Date de signature</Label>
        <Input
          id="asset-signature"
          type="date"
          value={signatureDate}
          onChange={(e) => setSignatureDate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-start">1re échéance</Label>
        <Input id="asset-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      {linkableAssets.length > 0 && (
        <div className="col-span-2 space-y-2">
          <Label>Finance</Label>
          {/* `items` is required: Base UI's <SelectValue/> renders the raw
              value — the bare id — unless the root is given the label map. */}
          <Select
            value={linkedAssetId}
            items={linkedAssetItems}
            onValueChange={(v) => v && setLinkedAssetId(v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun bien</SelectItem>
              {linkableAssets.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Le bien que ce prêt a financé — la maison pour un crédit immobilier.
          </p>
        </div>
      )}

      {deferralMonths !== null && (
        <p className="col-span-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
          Crédit différé : {deferralMonths} mois entre la signature et la
          première échéance. L&apos;échéancier démarre à la première échéance ;
          les intérêts intercalaires de la période de différé ne sont pas encore
          comptés dans le coût.
        </p>
      )}

      {/* Assurance emprunteur is priced per borrower — different ages, different
          quotités — so a couple's loan normally carries two different premiums. */}
      {splitInsurance && (
        <div className="col-span-2 space-y-2">
          <Label>Assurance emprunteur (€/mois, par personne)</Label>
          <div className="grid grid-cols-2 gap-3">
            {persons.map((p) => (
              <div key={p.id} className="space-y-1">
                <Label htmlFor={`ins-${p.id}`} className="text-xs font-normal text-muted-foreground">
                  {p.name}
                </Label>
                <Input
                  id={`ins-${p.id}`}
                  inputMode="decimal"
                  value={borrowerInsurance[p.id] ?? ""}
                  onChange={(e) =>
                    setBorrowerInsurance((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="0,00"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Total {formatCents(perBorrowerTotalCents)} par mois.
          </p>
        </div>
      )}

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
    if (balanceIsDerived) {
      // The schedule is the source of truth; the stored column is a snapshot
      // the server re-derives on every read anyway.
      valueCents = derivedBalanceCents as number;
    } else {
      try {
        valueCents = Math.abs(parseAmountToCents(value || "0"));
      } catch {
        toast.error("Montant invalide");
        return;
      }
    }
    const owners = ownersPayload();
    if (owners) {
      // Same rule as the server: an invalid split cannot be built at all.
      try {
        Ownership.fromRows(owners);
      } catch (err) {
        toast.error(isDomainError(err) ? err.message : "Quotes-parts invalides");
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
      body.taegBps = toBps(taeg);
      body.termMonths = term ? Number(term) : null;
      body.monthlyPaymentCents = toCents(monthly);
      // A split loan carries its premiums per borrower instead; keeping a
      // loan-level figure as well would double the insurance in the totals.
      body.insuranceMonthlyCents = splitInsurance ? null : toCents(insurance);
      body.feesCents = toCents(fees);
      body.signatureDate = signatureDate || null;
      body.startDate = startDate || null;
      body.linkedAssetId = linkedAssetId === "none" ? null : Number(linkedAssetId);
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
          <DialogTitle>
            {editing ? "Modifier" : "Ajouter"} {lockKind ? "un crédit" : "un élément"}
          </DialogTitle>
          <DialogDescription>
            {lockKind
              ? "Un emprunt : prêt immobilier, crédit auto, prêt personnel."
              : "Un actif (épargne, immobilier…) ou un passif (crédit, prêt)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className={lockKind ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
            {/* Omitted entirely when locked: on the Credits page the nature is
                the page itself, and offering "Actif" would let you create one
                from the wrong screen. */}
            {!lockKind && (
              <div className="space-y-2">
                <Label>Nature</Label>
                <Select value={kind} items={kindItems} onValueChange={(v) => v && changeKind(v as AssetRow["kind"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Actif</SelectItem>
                    <SelectItem value="liability">Passif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} items={ASSET_TYPE_LABELS} onValueChange={(v) => v && setType(v as AssetRow["type"])}>
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
          {balanceIsDerived ? (
            <div className="space-y-1.5">
              <Label>Solde restant dû</Label>
              <p className="text-lg font-semibold tabular-nums">
                {formatCents(derivedBalanceCents as number)}
              </p>
              <p className="text-xs text-muted-foreground">
                Calculé depuis l&apos;échéancier — capital, taux, durée et date
                de début. Il se met à jour tout seul à chaque échéance.
              </p>
            </div>
          ) : (
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
              {isLoan && (
                <p className="text-xs text-muted-foreground">
                  Renseignez capital, taux, durée et date de début ci-dessous
                  pour qu&apos;il soit calculé automatiquement.
                </p>
              )}
            </div>
          )}

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
                  {Ownership.even(persons.map((p) => p.id))
                    .toRows()
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
