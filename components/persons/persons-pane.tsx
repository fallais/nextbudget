"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Plus,
  Trash2,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersonForm } from "./person-form";
import { ContributionForm } from "./contribution-form";
import { formatCents, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Contribution, Person } from "@/lib/db/schema";
import type { ContributionStatus, PersonWithStatus } from "@/lib/db/contributions";

const STATE_META: Record<
  ContributionStatus["state"],
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  received: { label: "Reçu", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  pending: { label: "Attendu", icon: Clock, cls: "text-muted-foreground" },
  anomaly: { label: "Écart", icon: AlertTriangle, cls: "text-rose-600 dark:text-rose-400" },
};

export function PersonsPane({ perPerson }: { perPerson: PersonWithStatus[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<number | null>(
    perPerson[0]?.person.id ?? null,
  );
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [contribFormOpen, setContribFormOpen] = useState(false);
  const [editingContrib, setEditingContrib] = useState<Contribution | null>(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState<Person | null>(null);
  const [confirmDeleteContrib, setConfirmDeleteContrib] = useState<Contribution | null>(null);

  const selected =
    perPerson.find((p) => p.person.id === selectedId) ?? perPerson[0] ?? null;

  async function deletePerson(p: Person) {
    try {
      const res = await fetch(`/api/persons/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success(`« ${p.name} » supprimé`);
      setConfirmDeletePerson(null);
      if (selectedId === p.id) setSelectedId(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la suppression", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function deleteContrib(c: Contribution) {
    try {
      const res = await fetch(`/api/contributions/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success(`Apport supprimé`);
      setConfirmDeleteContrib(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la suppression", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Personnes</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingPerson(null);
                setPersonFormOpen(true);
              }}
            >
              <Plus className="mr-1 size-3" /> Nouvelle
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {perPerson.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune personne. Créez-en une pour commencer.
              </p>
            ) : (
              <ul className="space-y-1">
                {perPerson.map((p) => {
                  const active = selected?.person.id === p.person.id;
                  const ratio =
                    p.expectedTotalCents === 0
                      ? 0
                      : p.receivedTotalCents / p.expectedTotalCents;
                  const pct = Math.min(100, Math.round(ratio * 100));
                  return (
                    <li key={p.person.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.person.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors",
                          active ? "bg-accent" : "hover:bg-accent/50",
                          !p.person.isActive && "opacity-60",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <User className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate font-medium">{p.person.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {p.contributions.length}
                          </span>
                        </div>
                        {p.expectedTotalCents > 0 && (
                          <>
                            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                              <span>{formatCents(p.receivedTotalCents)}</span>
                              <span>{formatCents(p.expectedTotalCents)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full transition-all",
                                  ratio >= 1
                                    ? "bg-emerald-600"
                                    : ratio >= 0.8
                                      ? "bg-amber-500"
                                      : "bg-rose-600",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-2">
                <CardTitle className="text-base">{selected.person.name}</CardTitle>
                <CardDescription>
                  {selected.person.monthlySalaryCents
                    ? `Salaire : ${formatCents(selected.person.monthlySalaryCents)}/mois · `
                    : ""}
                  {selected.contributions.length} apport
                  {selected.contributions.length > 1 ? "s" : ""} ·{" "}
                  {formatCents(selected.expectedTotalCents)}/mois attendu
                </CardDescription>
                {selected.expectedTotalCents > 0 && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total reçu ce mois</span>
                      <span className="font-semibold tabular-nums">
                        {formatCents(selected.receivedTotalCents)} /{" "}
                        {formatCents(selected.expectedTotalCents)}
                      </span>
                    </div>
                    {selected.isConsolidated && (
                      <div className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <Sparkles className="mt-0.5 size-3 shrink-0" />
                        <span>
                          Apport consolidé détecté : le motif large a identifié
                          plus d'argent reçu ({formatCents(selected.receivedByBroadCents ?? 0)})
                          que la somme des apports individuels (
                          {formatCents(selected.receivedByContribCents)}).
                        </span>
                      </div>
                    )}
                    {selected.receivedByBroadCents === null && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Astuce : ajoute un motif large à cette personne pour
                        détecter les apports consolidés.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPerson(selected.person);
                    setPersonFormOpen(true);
                  }}
                >
                  <Pencil className="mr-1 size-3" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDeletePerson(selected.person)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Apports mensuels</h4>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingContrib(null);
                    setContribFormOpen(true);
                  }}
                >
                  <Plus className="mr-1 size-3" /> Ajouter un apport
                </Button>
              </div>

              {selected.contributions.length === 0 ? (
                <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Aucun apport. Ajoutez-en pour suivre les virements mensuels vers le Compte commun.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {selected.contributions.map((c) => {
                    const meta = STATE_META[c.state];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={c.contribution.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 hover:bg-muted/30",
                          !c.contribution.isActive && "opacity-50",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{c.contribution.name}</div>
                          <div className="font-mono text-xs text-muted-foreground truncate">
                            {c.contribution.matchPattern}
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums">
                          <div>{formatCents(c.contribution.expectedAmountCents)}</div>
                          <div className="text-xs text-muted-foreground">
                            tolérance {c.contribution.tolerancePct} %
                          </div>
                        </div>
                        <div className={cn("flex items-center gap-1.5 text-sm w-32", meta.cls)}>
                          <Icon className="size-3.5 shrink-0" />
                          <span>{meta.label}</span>
                          {c.state === "received" && c.matched[0] && (
                            <span className="text-xs text-muted-foreground">
                              {formatDateShort(c.matched[0].date)}
                            </span>
                          )}
                          {c.state === "anomaly" && c.variancePct !== null && (
                            <Badge variant="destructive" className="ml-1">
                              {c.variancePct > 0 ? "+" : ""}
                              {Math.round(c.variancePct)} %
                            </Badge>
                          )}
                        </div>
                        <div className="text-right text-sm tabular-nums w-24">
                          {c.matched.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="font-medium">
                              {formatCents(c.receivedCents)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => {
                              setEditingContrib(c.contribution);
                              setContribFormOpen(true);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeleteContrib(c.contribution)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex h-full items-center justify-center p-12 text-center text-sm text-muted-foreground">
              Créez d'abord une personne pour ajouter ses apports.
            </CardContent>
          </Card>
        )}
      </div>

      <PersonForm
        open={personFormOpen}
        onOpenChange={(o) => {
          setPersonFormOpen(o);
          if (!o) setEditingPerson(null);
        }}
        person={editingPerson}
      />
      {selected && (
        <ContributionForm
          open={contribFormOpen}
          onOpenChange={(o) => {
            setContribFormOpen(o);
            if (!o) setEditingContrib(null);
          }}
          personId={selected.person.id}
          contribution={editingContrib}
        />
      )}

      <AlertDialog
        open={confirmDeletePerson !== null}
        onOpenChange={(o) => !o && setConfirmDeletePerson(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette personne ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les apports de « {confirmDeletePerson?.name} » seront aussi
              supprimés. Les transactions existantes ne sont pas modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeletePerson && deletePerson(confirmDeletePerson)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteContrib !== null}
        onOpenChange={(o) => !o && setConfirmDeleteContrib(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet apport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne supprime aucune transaction, seulement le suivi de
              l'apport « {confirmDeleteContrib?.name} ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteContrib && deleteContrib(confirmDeleteContrib)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
