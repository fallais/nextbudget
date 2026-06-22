"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { RuleTest } from "./rule-test";
import type { Rule } from "@/lib/db/schema";

const MATCH_LABELS: Record<Rule["matchType"], string> = {
  contains: "Contient",
  equals: "Égal à",
  starts_with: "Commence par",
  regex: "Expression régulière",
};

const AMOUNT_LABELS: Record<Rule["amountCondition"], string> = {
  any: "Toutes les transactions",
  positive: "Recettes uniquement (montant positif)",
  negative: "Dépenses uniquement (montant négatif)",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: number;
  rule: Rule | null;
};

export function RuleForm({ open, onOpenChange, categoryId, rule }: Props) {
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<Rule["matchType"]>("contains");
  const [amountCondition, setAmountCondition] =
    useState<Rule["amountCondition"]>("any");
  const [priority, setPriority] = useState("100");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setPattern(rule?.pattern ?? "");
      setMatchType(rule?.matchType ?? "contains");
      setAmountCondition(rule?.amountCondition ?? "any");
      setPriority(rule ? String(rule.priority) : "100");
    }
  }, [open, rule]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        categoryId,
        pattern: pattern.trim(),
        matchType,
        amountCondition,
        priority: Number.parseInt(priority, 10) || 100,
        isActive: rule?.isActive ?? true,
      };
      const res = await fetch(
        rule ? `/api/rules/${rule.id}` : "/api/rules",
        {
          method: rule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(rule ? "Règle mise à jour" : "Règle créée");
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
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{rule ? "Modifier la règle" : "Nouvelle règle"}</DialogTitle>
            <DialogDescription>
              Une règle associe automatiquement les transactions à cette catégorie.
              Plus la priorité est basse, plus la règle est prioritaire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-type">Type de correspondance</Label>
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as Rule["matchType"])}
              >
                <SelectTrigger id="rule-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-pattern">Motif</Label>
              <Input
                id="rule-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                required
                placeholder="Ex. CARREFOUR"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Les descriptions sont normalisées (majuscules, sans accents) avant comparaison.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-amount">S'applique à</Label>
              <Select
                value={amountCondition}
                onValueChange={(v) =>
                  v && setAmountCondition(v as Rule["amountCondition"])
                }
              >
                <SelectTrigger id="rule-amount">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AMOUNT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-priority">Priorité</Label>
              <Input
                id="rule-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                min={0}
                max={10000}
              />
            </div>

            {pattern.trim().length > 0 && (
              <RuleTest
                pattern={pattern.trim()}
                matchType={matchType}
                amountCondition={amountCondition}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || pattern.trim().length === 0}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
