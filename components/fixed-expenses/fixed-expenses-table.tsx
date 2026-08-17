"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisibilityToggle } from "@/components/visibility-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { CategoryBadge } from "@/components/categories/category-badge";
import { FixedExpenseForm } from "./fixed-expense-form";
import { formatCents, formatDateShort } from "@shared/format";
import { cn } from "@shared/utils";
import type { Category, FixedExpense } from "@domain/entities";
import type { FixedExpenseStatus } from "@application/fixed-expenses";

const STATE_META: Record<
  FixedExpenseStatus["state"],
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  paid: { label: "Payé", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  pending: { label: "Attendu", icon: Clock, cls: "text-muted-foreground" },
  overdue: { label: "En retard", icon: AlertCircle, cls: "text-amber-600 dark:text-amber-400" },
  anomaly: { label: "Écart", icon: AlertTriangle, cls: "text-rose-600 dark:text-rose-400" },
};

export function FixedExpensesTable({
  statuses,
  categories,
}: {
  statuses: FixedExpenseStatus[];
  categories: Category[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FixedExpense | null>(null);

  async function deleteFx(fx: FixedExpense) {
    try {
      const res = await fetch(`/api/fixed-expenses/${fx.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success(`« ${fx.name} » supprimé`);
      setConfirmDelete(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la suppression", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="w-[80px] text-right">Échéance</TableHead>
              <TableHead className="text-right">Attendu</TableHead>
              <TableHead className="text-right">Débité ce mois</TableHead>
              <TableHead className="w-[180px]">État</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  Aucun frais fixe configuré.
                </TableCell>
              </TableRow>
            )}
            {statuses.map((s) => {
              const meta = STATE_META[s.state];
              const Icon = meta.icon;
              return (
                <TableRow key={s.fixedExpense.id} className={cn(!s.fixedExpense.isActive && "opacity-50")}>
                  <TableCell>
                    <div className="font-medium">{s.fixedExpense.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.fixedExpense.matchPattern}</div>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={s.category} />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {s.fixedExpense.dueDay ? `j ${s.fixedExpense.dueDay}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(s.fixedExpense.expectedAmountCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.matched.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-medium">
                        {formatCents(s.paidAmountCents)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-1.5 text-sm", meta.cls)}>
                      <Icon className="size-3.5" />
                      <span>{meta.label}</span>
                      {s.state === "paid" && s.matched[0] && (
                        <span className="text-xs text-muted-foreground">
                          le {formatDateShort(s.matched[0].date)}
                        </span>
                      )}
                      {s.state === "anomaly" && s.variancePct !== null && (
                        <Badge variant="destructive" className="ml-1">
                          {s.variancePct > 0 ? "+" : ""}
                          {Math.round(s.variancePct)} %
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <VisibilityToggle
                        kind="fixedExpense"
                        id={s.fixedExpense.id}
                        visibility={s.fixedExpense.visibility}
                        compact
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setEditing(s.fixedExpense);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(s.fixedExpense)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <FixedExpenseForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        fixedExpense={editing}
        categories={categories}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce frais fixe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne supprime aucune transaction, seulement le suivi du
              frais fixe « {confirmDelete?.name} ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteFx(confirmDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function NewFixedExpenseButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nouveau frais fixe</Button>
      <FixedExpenseForm
        open={open}
        onOpenChange={setOpen}
        fixedExpense={null}
        categories={categories}
      />
    </>
  );
}
