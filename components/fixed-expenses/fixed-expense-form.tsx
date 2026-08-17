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
import { Checkbox } from "@/components/ui/checkbox";
import type { CategoryRow, FixedExpenseRow } from "@domain/entities";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedExpense: FixedExpenseRow | null;
  categories: CategoryRow[];
};

export function FixedExpenseForm({ open, onOpenChange, fixedExpense, categories }: Props) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [tolerance, setTolerance] = useState("10");
  const [dueDay, setDueDay] = useState("");
  const [matchPattern, setMatchPattern] = useState("");
  const [matchType, setMatchType] = useState<"contains" | "starts_with" | "regex">("contains");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setName(fixedExpense?.name ?? "");
      setCategoryId(fixedExpense?.categoryId ? String(fixedExpense.categoryId) : "");
      setAmount(
        fixedExpense
          ? (fixedExpense.expectedAmountCents / 100).toFixed(2).replace(".", ",")
          : "",
      );
      setTolerance(String(fixedExpense?.tolerancePct ?? 10));
      setDueDay(fixedExpense?.dueDay ? String(fixedExpense.dueDay) : "");
      setMatchPattern(fixedExpense?.matchPattern ?? "");
      setMatchType(fixedExpense?.matchType ?? "contains");
      setIsActive(fixedExpense?.isActive ?? true);
    }
  }, [open, fixedExpense]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const cents = Math.round(Number(amount.replace(",", ".")) * 100);
      const payload = {
        name: name.trim(),
        categoryId: categoryId ? Number.parseInt(categoryId, 10) : null,
        expectedAmountCents: cents,
        tolerancePct: Number.parseInt(tolerance, 10) || 10,
        dueDay: dueDay ? Number.parseInt(dueDay, 10) : null,
        matchPattern: matchPattern.trim(),
        matchType,
        isActive,
      };
      const res = await fetch(
        fixedExpense ? `/api/fixed-expenses/${fixedExpense.id}` : "/api/fixed-expenses",
        {
          method: fixedExpense ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(fixedExpense ? "Frais fixe mis à jour" : "Frais fixe créé");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {fixedExpense ? "Modifier le frais fixe" : "Nouveau frais fixe"}
            </DialogTitle>
            <DialogDescription>
              Une dépense récurrente que vous attendez chaque mois (loyer, EDF, abonnement…).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fx-name">Nom</Label>
                <Input
                  id="fx-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. EDF"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fx-cat">Catégorie</Label>
                <Select value={categoryId} items={Object.fromEntries(categories.map((c) => [String(c.id), c.name]))} onValueChange={(v) => v && setCategoryId(v)}>
                  <SelectTrigger id="fx-cat">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fx-amt">Montant attendu (€)</Label>
                <Input
                  id="fx-amt"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fx-tol">Tolérance (%)</Label>
                <Input
                  id="fx-tol"
                  type="number"
                  min={0}
                  max={100}
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fx-due">Jour d'échéance</Label>
                <Input
                  id="fx-due"
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="Ex. 12"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label htmlFor="fx-pat">Motif de détection</Label>
                <Input
                  id="fx-pat"
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder="Ex. PRLV EDF"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fx-mtype">Type</Label>
                <Select
                  value={matchType}
                  items={{ contains: "contient", starts_with: "commence par", regex: "regex" }}
                  onValueChange={(v) => v && setMatchType(v as typeof matchType)}
                >
                  <SelectTrigger id="fx-mtype" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contient</SelectItem>
                    <SelectItem value="starts_with">commence par</SelectItem>
                    <SelectItem value="regex">regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isActive}
                onCheckedChange={(v) => setIsActive(v === true)}
              />
              Actif
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
