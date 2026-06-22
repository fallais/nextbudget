"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryCell } from "./category-cell";
import { formatCents, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/schema";
import type { ListedTransaction } from "@/lib/db/queries";

type Props = {
  rows: ListedTransaction[];
  total: number;
  page: number;
  pageSize: number;
  categories: Category[];
};

export function TransactionsTable({ rows, total, page, pageSize, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function goToPage(next: number) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === 1) sp.delete("page");
    else sp.set("page", String(next));
    router.push(`${pathname}?${sp.toString()}`);
  }

  function exportHref() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("page");
    return `/api/transactions/export?${sp.toString()}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Aucune transaction"
            : `${from.toLocaleString("fr-FR")}–${to.toLocaleString("fr-FR")} sur ${total.toLocaleString("fr-FR")}`}
        </p>
        <a
          href={exportHref()}
          download
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Download className="mr-2 size-3" />
          Exporter CSV
        </a>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[200px]">Catégorie</TableHead>
              <TableHead className="w-[140px]">Compte</TableHead>
              <TableHead className="w-[140px] text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                  Aucune transaction ne correspond à ces filtres.
                </TableCell>
              </TableRow>
            )}
            {rows.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-mono text-xs tabular-nums">
                  {formatDateShort(tx.date)}
                </TableCell>
                <TableCell className="max-w-md truncate" title={tx.description}>
                  {tx.description}
                </TableCell>
                <TableCell>
                  <CategoryCell
                    transactionId={tx.id}
                    current={tx.category}
                    categories={categories}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tx.account?.name ?? "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    tx.amountCents < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {formatCents(tx.amountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {page} / {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Suivant
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
