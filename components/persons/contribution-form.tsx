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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ContributionRow } from "@domain/entities";

type MatchType = "contains" | "starts_with" | "regex";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: number;
  contribution: ContributionRow | null;
};

export function ContributionForm({
  open,
  onOpenChange,
  personId,
  contribution,
}: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [matchPattern, setMatchPattern] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("contains");
  const [tolerance, setTolerance] = useState("10");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setName(contribution?.name ?? "");
      setAmount(
        contribution
          ? (contribution.expectedAmountCents / 100).toFixed(2).replace(".", ",")
          : "",
      );
      setMatchPattern(contribution?.matchPattern ?? "");
      setMatchType(contribution?.matchType ?? "contains");
      setTolerance(String(contribution?.tolerancePct ?? 10));
      setIsActive(contribution?.isActive ?? true);
    }
  }, [open, contribution]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const cents = Math.round(Number(amount.replace(",", ".")) * 100);
      const payload = {
        personId,
        name: name.trim(),
        expectedAmountCents: cents,
        matchPattern: matchPattern.trim(),
        matchType,
        tolerancePct: Number.parseInt(tolerance, 10) || 10,
        isActive,
      };
      const res = await fetch(
        contribution
          ? `/api/contributions/${contribution.id}`
          : "/api/contributions",
        {
          method: contribution ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(contribution ? "Apport mis à jour" : "Apport créé");
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
              {contribution ? "Modifier l'apport" : "Nouvel apport"}
            </DialogTitle>
            <DialogDescription>
              Un virement mensuel attendu vers le Compte commun. Vous pouvez en
              créer plusieurs par personne (un pour le loyer, un pour EDF, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-name">Nom</Label>
                <Input
                  id="c-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. Loyer"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-amt">Montant attendu (€)</Label>
                <Input
                  id="c-amt"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-32"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-pat">Motif de détection</Label>
                <Input
                  id="c-pat"
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder="Ex. VIR DE JEAN LOYER"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-type">Type</Label>
                <Select
                  value={matchType}
                  items={{ contains: "contient", starts_with: "commence par", regex: "regex" }}
                  onValueChange={(v) => v && setMatchType(v as MatchType)}
                >
                  <SelectTrigger id="c-type" className="w-32">
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

            <div className="space-y-2">
              <Label htmlFor="c-tol">Tolérance (%)</Label>
              <Input
                id="c-tol"
                type="number"
                min={0}
                max={100}
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className="w-24"
              />
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
            <Button
              type="submit"
              disabled={saving || name.trim().length === 0 || matchPattern.trim().length === 0}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
