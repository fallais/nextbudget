import { notFound } from "next/navigation";
import {
  getFixedExpenseHistory,
  getFixedExpenseStatus,
} from "@application/fixed-expenses";
import { listAllCategories } from "@application/queries";
import { FixedExpenseDetail } from "@/components/fixed-expenses/fixed-expense-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One charge: this month against what was expected, then a year of it — which
 * is where an indexed rent or a subscription that crept up becomes visible.
 */
export default async function FixedExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expenseId = Number.parseInt(id, 10);
  if (!Number.isInteger(expenseId)) notFound();

  const status = await getFixedExpenseStatus(expenseId);
  if (!status) notFound();

  const [history, categories] = await Promise.all([
    getFixedExpenseHistory(expenseId),
    listAllCategories(),
  ]);

  return <FixedExpenseDetail status={status} history={history} categories={categories} />;
}
