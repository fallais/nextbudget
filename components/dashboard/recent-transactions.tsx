import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryBadge } from "@/components/categories/category-badge";
import { formatCents, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListedTransaction } from "@/lib/db/queries";

export function RecentTransactions({ rows }: { rows: ListedTransaction[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aucune transaction enregistrée. Importez vos relevés pour commencer.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-md border bg-card">
      {rows.map((tx) => (
        <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatDateShort(tx.date)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm" title={tx.description}>
            {tx.description}
          </span>
          <CategoryBadge category={tx.category} />
          <span
            className={cn(
              "w-28 text-right text-sm font-medium tabular-nums",
              tx.amountCents < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {formatCents(tx.amountCents)}
          </span>
        </li>
      ))}
      <li className="px-4 py-2 text-right">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Voir toutes les transactions <ArrowRight className="size-3" />
        </Link>
      </li>
    </ul>
  );
}
