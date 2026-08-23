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
 * One charge: its current period against what was expected, then the history,
 * which is where an indexed rent or a subscription that crept up shows.
 *
 * A yearly charge gets two years of it, because one year of a yearly charge is
 * a single bar with nothing to compare it against.
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
    getFixedExpenseHistory(expenseId, status.fixedExpense.cadence === "yearly" ? 24 : 12),
    listAllCategories(),
  ]);

  return <FixedExpenseDetail status={status} history={history} categories={categories} />;
}
