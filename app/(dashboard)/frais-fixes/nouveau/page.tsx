import { listAllCategories } from "@application/queries";
import { NewFixedExpenseForm } from "@/components/fixed-expenses/new-fixed-expense-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewFixedExpensePage() {
  return <NewFixedExpenseForm categories={await listAllCategories()} />;
}
