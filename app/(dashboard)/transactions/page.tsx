import { Suspense } from "react";
import {
  listTransactions,
  listAllCategories,
  listAllAccounts,
  type TransactionFilters,
} from "@application/queries";
import { TransactionsFilters } from "@/components/transactions/filters";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Filtrez, catégorisez et exportez vos transactions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
        <Suspense fallback={<Skeleton className="h-[600px]" />}>
          <TransactionsFilters categories={categories} accounts={accounts} />
        </Suspense>
        <TransactionsTable
          rows={data.rows}
          total={data.total}
          page={page}
          pageSize={PAGE_SIZE}
          categories={categories}
        />
      </div>
    </div>
  );
}
