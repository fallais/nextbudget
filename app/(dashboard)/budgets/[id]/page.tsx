import { notFound } from "next/navigation";
import { getBudgetStatus, getCategoryMonthlySpend } from "@application/budgets";
import { monthlyEquivalentCents } from "@domain/entities";
import { listTransactions } from "@application/queries";
import { BudgetDetail } from "@/components/budgets/budget-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT = 8;

/**
 * One budget, in full: this period against the ceiling, the months before it,
 * and the spending that made it up — none of which fits in a list row.
 */
export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budgetId = Number.parseInt(id, 10);
  if (!Number.isInteger(budgetId)) notFound();

  const status = await getBudgetStatus(budgetId);
  if (!status) notFound();

  const [history, transactions] = await Promise.all([
    getCategoryMonthlySpend(status.category.id),
    listTransactions(
      {
        categoryIds: [status.category.id],
        from: status.periodStart,
        to: status.periodEnd,
        // Expenses only — a refund landing in the category does not count
        // against a ceiling, and the spent figure above ignores it too.
        amountMax: -1,
      },
      { page: 1, pageSize: RECENT },
    ),
  ]);

  return (
    <BudgetDetail
      status={status}
      history={history}
      monthlyCeilingCents={monthlyEquivalentCents(status.budgetCents, status.period)}
      transactions={transactions.rows.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amountCents: t.amountCents,
      }))}
      transactionsTotal={transactions.total}
    />
  );
}
