import { notFound } from "next/navigation";
import { findCategory, listCategories } from "@application/categories";
import { listRules } from "@application/rules";
import { listMerchants } from "@application/categorize/merchants";
import { getCategoryBreakdown } from "@application/stats";
import { listTransactions } from "@application/queries";
import { periodToRange } from "@domain/value-objects/period";
import { CategoryDetail } from "@/components/categories/category-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One category: your rules first, then the merchants the app already knows —
 * which is also the order the engine tries them in.
 */
export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const categoryId = Number.parseInt(id, 10);
  if (!Number.isInteger(categoryId)) notFound();

  const category = await findCategory(categoryId);
  if (!category) notFound();

  const [allCategories, allRules, merchants, breakdown] = await Promise.all([
    listCategories(),
    listRules(),
    listMerchants(),
    getCategoryBreakdown("month"),
  ]);

  const rows = allRules.filter((r) => r.categoryId === categoryId);
  const spent = breakdown.find((b) => b.id === categoryId);
  // Same window as the spend beside it — two figures about different months
  // in one sentence would be worse than either alone.
  const { from, to } = periodToRange("month");
  const { total } = await listTransactions(
    { categoryIds: [categoryId], from, to },
    { page: 1, pageSize: 1 },
  );

  return (
    <CategoryDetail
      category={category}
      categories={allCategories}
      rules={rows}
      merchants={merchants}
      spentCents={Math.abs(spent?.totalCents ?? 0)}
      transactionCount={total}
    />
  );
}
