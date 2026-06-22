"use client";

import { useState, useEffect, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/db/schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  current?: { amountCents: number; period: "weekly" | "monthly" } | null;
};

export function BudgetForm({ open, onOpenChange, category, current }: Props) {
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setAmount(current ? (current.amountCents / 100).toFixed(2).replace(".", ",") : "");
      setPeriod(current?.period ?? "monthly");
    }
    // Depend on the primitive budget values (not the object) to avoid resetting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.amountCents, current?.period]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    setSaving(true);
    try {
      const trimmed = amount.trim();
      const cents = trimmed
        ? Math.round(Number(trimmed.replace(",", ".")) * 100)
        : null;
      const payload =
        cents === null || !Number.isFinite(cents) || cents <= 0
          ? { budgetAmountCents: null, budgetPeriod: null }
          : { budgetAmountCents: cents, budgetPeriod: period };

      const res = await fetch(`/api/categories/${category.id}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(payload.budgetAmountCents === null ? "Budget supprimé" : "Budget enregistré");
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de l'enregistrement", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!category) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${category.id}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetAmountCents: null, budgetPeriod: null }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success("Budget supprimé");
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la suppression", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Budget · {category?.name}</DialogTitle>
            <DialogDescription>
              Définissez un montant par semaine ou par mois. Laisser vide pour
              ne plus suivre cette catégorie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Montant (€)</Label>
              <Input
                id="budget-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex. 600,00"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-period">Période</Label>
              <Select
                value={period}
                onValueChange={(v) => v && setPeriod(v as "weekly" | "monthly")}
              >
                <SelectTrigger id="budget-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Par mois</SelectItem>
                  <SelectItem value="weekly">Par semaine (lundi → dimanche)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {current && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                Supprimer
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
