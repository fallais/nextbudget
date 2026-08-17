"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { CategoryBadge } from "./category-badge";
import { CategoryForm } from "./category-form";
import { RuleForm } from "./rule-form";
import { RecategorizeButton } from "./recategorize-button";
import { getCategoryIcon } from "@shared/category-icons";
import { cn } from "@shared/utils";
import type { CategoryRow, RuleRow } from "@domain/entities";

const MATCH_LABELS: Record<RuleRow["matchType"], string> = {
  contains: "contient",
  equals: "égal à",
  starts_with: "commence par",
  regex: "regex",
};

const AMOUNT_HINT: Record<RuleRow["amountCondition"], string | null> = {
  any: null,
  positive: "+",
  negative: "−",
};

type Props = {
  categories: CategoryRow[];
  rulesByCategory: Record<number, RuleRow[]>;
};

export function CategoriesPane({ categories, rulesByCategory }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<number | null>(
    categories[0]?.id ?? null,
  );
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRow | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<CategoryRow | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<RuleRow | null>(null);

  const selected = categories.find((c) => c.id === selectedId) ?? categories[0] ?? null;
  const rules = selected ? rulesByCategory[selected.id] ?? [] : [];

  async function deleteCategory(c: CategoryRow) {
    try {
      const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success(`Catégorie « ${c.name} » supprimée`);
      setConfirmDeleteCat(null);
      if (selectedId === c.id) setSelectedId(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la suppression", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function deleteRule(r: RuleRow) {
    try {
      const res = await fetch(`/api/rules/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success("Règle supprimée");
      setConfirmDeleteRule(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la suppression", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Catégories</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingCat(null);
                setCatFormOpen(true);
              }}
            >
              <Plus className="mr-1 size-3" /> Nouvelle
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            <ul className="space-y-1">
              {categories.map((c) => {
                const Icon = getCategoryIcon(c.icon);
                const active = selected?.id === c.id;
                const count = rulesByCategory[c.id]?.length ?? 0;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        active ? "bg-accent" : "hover:bg-accent/50",
                      )}
                    >
                      <span
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded"
                        style={{ backgroundColor: `${c.color}33`, color: c.color }}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-2">
                <CategoryBadge category={selected} size="md" />
                <CardDescription>
                  {rules.length} règle{rules.length > 1 ? "s" : ""}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingCat(selected);
                    setCatFormOpen(true);
                  }}
                >
                  <Pencil className="mr-1 size-3" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDeleteCat(selected)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Règles de catégorisation</h4>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRule(null);
                    setRuleFormOpen(true);
                  }}
                >
                  <Plus className="mr-1 size-3" /> Ajouter une règle
                </Button>
              </div>

              {rules.length === 0 ? (
                <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Aucune règle. Ajoutez-en une pour catégoriser automatiquement les
                  transactions qui correspondent.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {rules.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30"
                    >
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        {MATCH_LABELS[r.matchType]}
                      </span>
                      <code className="flex-1 truncate text-sm">{r.pattern}</code>
                      {AMOUNT_HINT[r.amountCondition] && (
                        <span
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                          title={
                            r.amountCondition === "positive"
                              ? "Recettes uniquement"
                              : "Dépenses uniquement"
                          }
                        >
                          {AMOUNT_HINT[r.amountCondition]}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        p{r.priority}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setEditingRule(r);
                          setRuleFormOpen(true);
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDeleteRule(r)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end border-t pt-3">
                <RecategorizeButton variant="outline" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex h-full items-center justify-center p-12 text-center text-sm text-muted-foreground">
              Sélectionnez une catégorie ou créez-en une nouvelle.
            </CardContent>
          </Card>
        )}
      </div>

      <CategoryForm
        open={catFormOpen}
        onOpenChange={setCatFormOpen}
        category={editingCat}
      />
      {selected && (
        <RuleForm
          open={ruleFormOpen}
          onOpenChange={setRuleFormOpen}
          categoryId={selected.id}
          rule={editingRule}
        />
      )}

      <AlertDialog
        open={confirmDeleteCat !== null}
        onOpenChange={(open) => !open && setConfirmDeleteCat(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les transactions actuellement classées dans «{" "}
              {confirmDeleteCat?.name} » ne seront plus catégorisées. Les règles
              associées seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteCat && deleteCategory(confirmDeleteCat)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteRule !== null}
        onOpenChange={(open) => !open && setConfirmDeleteRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette règle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Vous pouvez relancer une
              recatégorisation après suppression.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteRule && deleteRule(confirmDeleteRule)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
