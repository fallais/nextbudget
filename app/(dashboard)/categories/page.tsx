import { categories as categoryRepo, rules as ruleRepo } from "@infrastructure/persistence/repositories";
import type { RuleRow } from "@domain/entities";
import { CategoriesView } from "@/components/categories/categories-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categoryEntities, ruleEntities] = await Promise.all([
    categoryRepo.findAll(),
    ruleRepo.findAll(),
  ]);

  // Class instances cannot cross into a Client Component, so hand over rows.
  const rulesByCategory: Record<number, RuleRow[]> = {};
  for (const rule of ruleEntities) {
    const row = rule.toRow();
    (rulesByCategory[row.categoryId] ??= []).push(row);
  }

  return (
    <CategoriesView
      categories={categoryEntities.map((c) => c.toRow())}
      rulesByCategory={rulesByCategory}
    />
  );
}
