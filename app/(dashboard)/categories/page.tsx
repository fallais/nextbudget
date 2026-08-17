import { getDataSource } from "@infrastructure/db/client";
import { CategoryEntity, RuleEntity } from "@infrastructure/db/schemas";
import type { RuleRow } from "@domain/entities";
import { CategoriesPane } from "@/components/categories/categories-pane";
import { RecategorizeButton } from "@/components/categories/recategorize-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const ds = await getDataSource();
  const [categories, rules] = await Promise.all([
    ds.getRepository(CategoryEntity).find({ order: { name: "ASC" } }),
    ds.getRepository(RuleEntity).find({ order: { priority: "ASC" } }),
  ]);

  const rulesByCategory: Record<number, RuleRow[]> = {};
  for (const r of rules) {
    (rulesByCategory[r.categoryId] ??= []).push(r);
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
