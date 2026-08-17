"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@shared/utils";
import { formatCents } from "@shared/format";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { AssetForm, ASSET_TYPE_LABELS, type FormPerson } from "./asset-form";
import { AmortizationDetail } from "./amortization-detail";
import { formatBps, type OwnerShareRow } from "@domain/value-objects/share";
import type { AssetRow } from "@domain/entities";

export function AssetsPane({
  assets,
  accounts,
  persons = [],
  ownersByAsset = {},
  mePersonId = null,
}: {
  assets: AssetRow[];
  accounts: { id: number; name: string }[];
  persons?: FormPerson[];
  ownersByAsset?: Record<number, OwnerShareRow[]>;
  mePersonId?: number | null;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  function openForm(a: AssetRow | null) {
    setEditing(a);
    setFormOpen(true);
  }

  async function remove(a: AssetRow) {
    if (!window.confirm(`Supprimer « ${a.name} » ?`)) return;
    const res = await fetch(`/api/assets/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Échec de la suppression");
      return;
    }
    toast.success("Supprimé");
    router.refresh();
  }

  /**
   * "Alex 60 % · Camille 40 %", or nothing at all for a solo household or an
   * asset left on the implicit default — no point repeating "100 % à moi" on
   * every row.
   */
  function shareLabel(assetId: number): string | null {
    if (persons.length < 2) return null;
    const shares = ownersByAsset[assetId];
    if (!shares || shares.length === 0) return null;
    return shares
      .map((s) => `${persons.find((p) => p.id === s.personId)?.name ?? "—"} ${formatBps(s.shareBps)}`)
      .join(" · ");
  }

  function renderSection(title: string, list: AssetRow[]) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">Aucun élément.</p>
        ) : (
          <div className="space-y-2">
            {list.map((a) => {
              const isLoan = a.type === "loan" || a.type === "mortgage";
              const isOpen = expanded === a.id;
              return (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{a.name}</span>
                          <Badge variant="secondary">{ASSET_TYPE_LABELS[a.type]}</Badge>
                        </div>
                        {shareLabel(a.id) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {shareLabel(a.id)}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "tabular-nums font-semibold",
                          a.kind === "liability" && "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {a.kind === "liability" ? "−" : ""}
                        {formatCents(a.valueCents)}
                      </span>
                      {isLoan && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setExpanded(isOpen ? null : a.id)}
                          aria-label="Échéancier"
                        >
                          <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                        </Button>
                      )}
                      <VisibilityToggle kind="asset" id={a.id} visibility={a.visibility} compact />
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openForm(a)} aria-label="Modifier">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => void remove(a)} aria-label="Supprimer">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {isLoan && isOpen && (
                      <div className="mt-3 border-t pt-3">
                        <AmortizationDetail asset={a} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Actifs &amp; passifs</h3>
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>
      {renderSection("Actifs", assets.filter((a) => a.kind === "asset"))}
      {renderSection("Passifs", assets.filter((a) => a.kind === "liability"))}
      <AssetForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
        accounts={accounts}
        persons={persons}
        owners={editing ? (ownersByAsset[editing.id] ?? []) : []}
        mePersonId={mePersonId}
      />
    </div>
  );
}
