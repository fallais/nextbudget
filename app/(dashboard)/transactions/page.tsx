import {
  listTransactions,
  listAllCategories,
  listAllAccounts,
  type TransactionFilters,
} from "@application/queries";
import { TransactionsView } from "@/components/transactions/transactions-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function parseIntList(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const filters: TransactionFilters = {
    from: get("from"),
    to: get("to"),
    search: get("search"),
    categoryIds: parseIntList(get("categoryIds")),
    accountIds: parseIntList(get("accountIds")),
    uncategorized: get("uncategorized") === "1",
    amountMin: get("amountMin") ? Number.parseInt(get("amountMin")!, 10) : undefined,
    amountMax: get("amountMax") ? Number.parseInt(get("amountMax")!, 10) : undefined,
  };
  const page = Math.max(1, Number.parseInt(get("page") ?? "1", 10) || 1);

  const [data, categories, accounts] = await Promise.all([
    listTransactions(filters, { page, pageSize: PAGE_SIZE }),
    listAllCategories(),
    listAllAccounts(),
  ]);

  return (
    <TransactionsView
      rows={data.rows}
      total={data.total}
      page={page}
      pageSize={PAGE_SIZE}
      categories={categories}
      accounts={accounts}
    />
  );
}
