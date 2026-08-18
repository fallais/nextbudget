import { categories as categoryRepo, rules as ruleRepo } from "@infrastructure/persistence/repositories";
import type { RuleRow } from "@domain/entities";
import { CategoriesPane } from "@/components/categories/categories-pane";
import { RecategorizeButton } from "@/components/categories/recategorize-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categoryEntities, ruleEntities] = await Promise.all([
    categoryRepo.findAll(),
    ruleRepo.findAll(),
  ]);

  // Class instances cannot cross into a Client Component, so hand the pane rows.
  const categories = categoryEntities.map((c) => c.toRow());

  const rulesByCategory: Record<number, RuleRow[]> = {};
  for (const rule of ruleEntities) {
    const row = rule.toRow();
    (rulesByCategory[row.categoryId] ??= []).push(row);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Catégories</h2>
          <p className="text-sm text-muted-foreground">
            Gérez vos catégories et leurs règles de classement automatique.
          </p>
        </div>
        <RecategorizeButton />
      </div>

      <CategoriesPane categories={categories} rulesByCategory={rulesByCategory} />
    </div>
  );
}
