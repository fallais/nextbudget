import "server-only";
import { transactions } from "@infrastructure/persistence/repositories";
import type { TransactionRow } from "@domain/entities";
import type { TransactionRepository } from "@domain/repositories";

/**
 * Writes against a transaction.
 *
 * Reading them is `queries.ts`; this is the side that changes something. The
 * only field the app lets you change by hand is the category — an imported
 * line's date, amount and label are what the bank said, and editing those
 * would break the dedup hash that stops the next import duplicating the row.
 */

export type TransactionDeps = {
  transactions: Pick<TransactionRepository, "update" | "countByAccountGrouped">;
};

const LIVE: TransactionDeps = { transactions };

/** Resolves `null` when no transaction has that id. */
export async function recategorizeTransaction(
  transactionId: number,
  categoryId: number | null,
  deps: TransactionDeps = LIVE,
): Promise<TransactionRow | null> {
  const updated = await deps.transactions.update(transactionId, { categoryId });
  return updated?.toRow() ?? null;
}

/** How many transactions each account holds, for the screen that offers to delete one. */
export async function countTransactionsByAccount(
  deps: TransactionDeps = LIVE,
): Promise<Map<number, number>> {
  return deps.transactions.countByAccountGrouped();
}
