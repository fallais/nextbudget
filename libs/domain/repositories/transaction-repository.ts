import type { Transaction, TransactionRow, NewTransaction } from "@domain/entities";
import type { Repository } from "./repository";

export interface TransactionRepository
  extends Repository<Transaction, TransactionRow, NewTransaction> {
  /** How many transactions an account holds — deleting a non-empty one is refused. */
  countByAccount(accountId: number): Promise<number>;

  /** Counts for every account at once, keyed by account id — one query, not one per account. */
  countByAccountGrouped(): Promise<Map<number, number>>;

  /**
   * Detach every transaction from a category, for when that category is
   * deleted. There are no DB-level FKs, so `ON DELETE SET NULL` has to be
   * reproduced here or the rows keep pointing at an id that no longer exists.
   */
  clearCategory(categoryId: number): Promise<void>;
}
