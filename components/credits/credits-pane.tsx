"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Link2, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@shared/utils";
import { formatCents, formatDateShort } from "@shared/format";
import { AssetForm, ASSET_TYPE_LABELS, type FormPerson } from "@/components/assets/asset-form";
import { AmortizationDetail } from "@/components/assets/amortization-detail";
import type { AssetRow } from "@domain/entities";
import type { AssetOwnerInput } from "@domain/repositories";
import type { CreditListItem } from "@application/credits";

export function CreditsPane({
  credits,
  linkableAssets,
  accounts,
  persons = [],
  ownersByAsset = {},
  mePersonId = null,
}: {
  credits: CreditListItem[];
  linkableAssets: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  persons?: FormPerson[];
  /**
   * Required for editing, not decoration: `AssetForm` derives its share mode
   * from these, and an empty set reads as "wholly mine" — so omitting them
   * would rewrite a 50/50 loan to a sole owner on the next save.
   */
  ownersByAsset?: Record<number, AssetOwnerInput[]>;
  mePersonId?: number | null;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  function openForm(credit: AssetRow | null) {
    setEditing(credit);
    setFormOpen(true);
  }

  async function remove(credit: AssetRow) {
    if (!window.confirm(`Supprimer « ${credit.name} » ?`)) return;
    const res = await fetch(`/api/assets/${credit.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Échec de la suppression");
      return;
    }
    toast.success("Supprimé");
    router.refresh();
  }

  if (credits.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div>
              <p className="font-medium">Aucun crédit</p>
              <p className="text-sm text-muted-foreground">
                Ajoutez un prêt immobilier, un crédit auto ou un prêt personnel
                pour suivre son coût réel et son échéancier.
              </p>
            </div>
            <Button onClick={() => openForm(null)}>
              <Plus className="size-4" /> Ajouter un crédit
            </Button>
          </CardContent>
        </Card>
        <AssetForm
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          asset={editing}
          accounts={accounts}
          persons={persons}
          owners={editing ? (ownersByAsset[editing.id] ?? []) : []}
          mePersonId={mePersonId}
          defaultKind="liability"
          lockKind
          linkableAssets={linkableAssets}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => openForm(null)}>
          <Plus className="size-4" /> Ajouter un crédit
        </Button>
      </div>

      {credits.map(({ credit, linkedAsset, summary, borrowers, deferralMonths }) => {
        const isOpen = expanded === credit.id;
        return (
          <Card key={credit.id} className={cn(!credit.isActive && "opacity-60")}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{credit.name}</span>
                    <Badge variant="secondary">
                      {ASSET_TYPE_LABELS[credit.type] ?? credit.type}
                    </Badge>
                    {!credit.isActive && <Badge variant="outline">Soldé</Badge>}
                  </div>
                  <p className="text-sm text-rose-600 tabular-nums dark:text-rose-400">
                    −{formatCents(credit.valueCents)} restant dû
                    {summary && (
                      <span className="text-muted-foreground">
                        {" "}
                        · échéance {formatCents(summary.monthlyPaymentCents)}
                        {/* Spelled out rather than folded into one figure: the
                            échéance on the offer is capital + interest, while
                            the insurance is often debited separately. Showing
                            only the total makes it look like the schedule
                            disagrees with the contract when it does not. */}
                        {summary.monthlyTotalCents > summary.monthlyPaymentCents && (
                          <>
                            {" "}
                            + {formatCents(summary.monthlyTotalCents - summary.monthlyPaymentCents)}{" "}
                            d&apos;assurance = {formatCents(summary.monthlyTotalCents)}
                          </>
                        )}
                        /mois
                      </span>
                    )}
                    {summary?.endDate && (
                      <span className="text-muted-foreground">
                        {" "}
                        · jusqu&apos;au {formatDateShort(summary.endDate)}
                      </span>
                    )}
                  </p>
                  {deferralMonths !== null && (
                    <p className="text-xs text-muted-foreground">
                      Différé de {deferralMonths} mois — signé le{" "}
                      {credit.signatureDate ? formatDateShort(credit.signatureDate) : "—"},
                      première échéance le{" "}
                      {credit.startDate ? formatDateShort(credit.startDate) : "—"}
                    </p>
                  )}
                  {/* Assurance emprunteur is quoted per head, so a shared loan
                      carries two different premiums rather than one figure. */}
                  {borrowers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Assurance :{" "}
                      {borrowers
                        .map(
                          (b) =>
                            `${b.personName} ${
                              b.monthlyCents != null ? formatCents(b.monthlyCents) : "—"
                            }/mois`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openForm(credit)}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Modifier</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(credit)}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">Supprimer</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpanded(isOpen ? null : credit.id)}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                    <span className="sr-only">Détail</span>
                  </Button>
                </div>
              </div>

              {/* What the loan paid for — read-only. Changing what a credit
                  finances is editing the credit, so it belongs in the edit
                  dialog with the rest of its fields, not inline on a list. */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {linkedAsset ? (
                  <>
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Finance</span>
                    <span className="font-medium">{linkedAsset.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      valorisé {formatCents(linkedAsset.valueCents)} ·{" "}
                      <Link href="/patrimoine" className="text-primary hover:underline">
                        voir dans le patrimoine
                      </Link>
                    </span>
                  </>
                ) : (
                  <>
                    <Unlink className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Rattaché à aucun bien
                    </span>
                  </>
                )}
              </div>

              {/* Net position: what the thing is worth minus what is still owed. */}
              {linkedAsset && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Valeur nette du bien :{" "}
                  <span
                    className={cn(
                      "font-medium",
                      linkedAsset.valueCents - credit.valueCents >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {formatCents(linkedAsset.valueCents - credit.valueCents)}
                  </span>
                </p>
              )}

              {isOpen && (
                <div className="border-t pt-3">
                  <AmortizationDetail asset={credit} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* `key` forces a remount when the target changes: AssetForm seeds every
          field with a `useState` initializer, which only runs on mount — without
          this the dialog keeps whatever it was first opened with (an empty
          "new credit" form) no matter which pencil you click. */}
      <AssetForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
        accounts={accounts}
        persons={persons}
        owners={editing ? (ownersByAsset[editing.id] ?? []) : []}
        mePersonId={mePersonId}
        defaultKind="liability"
          lockKind
      />
    </div>
  );
}
