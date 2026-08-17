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
import type { Person } from "@/lib/db/schema";

type MatchType = "contains" | "starts_with" | "regex";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person | null;
};

export function PersonForm({ open, onOpenChange, person }: Props) {
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [matchPattern, setMatchPattern] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("contains");
  const [tolerance, setTolerance] = useState("5");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setName(person?.name ?? "");
      setSalary(
        person?.monthlySalaryCents
          ? (person.monthlySalaryCents / 100).toFixed(2).replace(".", ",")
          : "",
      );
      setMatchPattern(person?.matchPattern ?? "");
      setMatchType(person?.matchType ?? "contains");
      setTolerance(String(person?.tolerancePct ?? 5));
      setIsActive(person?.isActive ?? true);
    }
  }, [open, person]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const salaryCents = salary.trim()
        ? Math.round(Number(salary.replace(",", ".")) * 100)
        : null;
      const payload = {
        name: name.trim(),
        monthlySalaryCents:
          salaryCents !== null && Number.isFinite(salaryCents) && salaryCents > 0
            ? salaryCents
            : null,
        matchPattern: matchPattern.trim() || null,
        matchType: matchPattern.trim() ? matchType : undefined,
        tolerancePct: Number.parseInt(tolerance, 10) || 5,
        isActive,
      };
      const res = await fetch(
        person ? `/api/persons/${person.id}` : "/api/persons",
        {
          method: person ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(person ? "Personne mise à jour" : "Personne créée");
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
              {person ? "Modifier la personne" : "Nouvelle personne"}
            </DialogTitle>
            <DialogDescription>
              Le salaire est informationnel. Le motif large permet de réconcilier
              automatiquement les apports consolidés (un gros virement qui couvre
              plusieurs apports prévus).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label htmlFor="person-name">Nom</Label>
                <Input
                  id="person-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="person-salary">Salaire (€/mois) — optionnel</Label>
                <Input
                  id="person-salary"
                  inputMode="decimal"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="2500,00"
                  className="w-40"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label htmlFor="person-pat" className="text-sm">
                Motif large (toute entrée d'argent de cette personne)
              </Label>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <Input
                  id="person-pat"
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder="Ex. DURAND  ou  12345678|DURAND|JEAN"
                />
                <Select
                  value={matchType}
                  items={{ contains: "contient", starts_with: "commence par", regex: "regex" }}
                  onValueChange={(v) => v && setMatchType(v as MatchType)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contient</SelectItem>
                    <SelectItem value="starts_with">commence par</SelectItem>
                    <SelectItem value="regex">regex</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={tolerance}
                    onChange={(e) => setTolerance(e.target.value)}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Optionnel mais recommandé : permet de détecter qu'un mois est «
                couvert » même si les apports individuels n'ont pas été
                identifiés un par un (apport consolidé).
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isActive}
                onCheckedChange={(v) => setIsActive(v === true)}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || name.trim().length === 0}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
