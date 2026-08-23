import { listCategories } from "@application/categories";
import { listRules } from "@application/rules";
import { listMerchants } from "@application/categorize/merchants";
import { getCategoryBreakdown } from "@application/stats";
import { CategoriesView } from "@/components/categories/categories-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categoryEntities, ruleEntities, merchants, breakdown] = await Promise.all([
    listCategories(),
    listRules(),
    listMerchants(),
    getCategoryBreakdown("month"),
  ]);

  const ruleCounts = new Map<number, number>();
  for (const { categoryId } of ruleEntities) {
    ruleCounts.set(categoryId, (ruleCounts.get(categoryId) ?? 0) + 1);
  }

  const merchantCounts = new Map<number, number>();
  for (const m of merchants) {
    if (m.categoryId === null || m.disabled) continue;
    merchantCounts.set(m.categoryId, (merchantCounts.get(m.categoryId) ?? 0) + 1);
  }

  const spent = new Map(breakdown.map((b) => [b.id, Math.abs(b.totalCents)]));

  const items = categoryEntities
    .map((category) => ({
      category,
      ruleCount: ruleCounts.get(category.id) ?? 0,
      merchantCount: merchantCounts.get(category.id) ?? 0,
      spentCents: spent.get(category.id) ?? 0,
    }))
    // Most spent first: the page is read to find where the money went, and an
    // alphabetical list puts "Animaux & Jardin" above the rent every time.
    .sort((a, b) => b.spentCents - a.spentCents || a.category.name.localeCompare(b.category.name, "fr"));

  return <CategoriesView items={items} merchantTotal={merchants.filter((m) => !m.disabled).length} />;
}
