import type { Transaction, TransactionRow, NewTransaction } from "@domain/entities";
import type { TransferLeg } from "@domain/services/transfers";
import type { Repository } from "./repository";

export interface TransactionRepository
  extends Repository<Transaction, TransactionRow, NewTransaction> {
  /** How many transactions an account holds — deleting a non-empty one is refused. */
  countByAccount(accountId: number): Promise<number>;

  /** Counts for every account at once, keyed by account id — one query, not one per account. */
  countByAccountGrouped(): Promise<Map<number, number>>;

  /**
   * Every transaction, or only the ones nobody has filed yet.
   *
   * The whole table, deliberately: recategorising is a batch operation over
   * what has already been imported, and paging it would mean the rules could
   * change under it half way through.
   */
  findForCategorization(onlyUncategorized: boolean): Promise<TransactionRow[]>;

  /**
   * How many times each fingerprint already exists in an account, over the
   * span a statement covers.
   *
   * One grouped query rather than a lookup per row: a statement is a month or
   * a year, so its date range is what bounds the work. Keyed by the same
   * fingerprint the ingest builds, so the caller can subtract directly.
   */
  countFingerprintsInRange(
    accountId: number,
    from: string,
    to: string,
  ): Promise<{ date: string; amountCents: number; normalizedDescription: string; count: number }[]>;

  /**
   * Write one imported row, reporting a duplicate rather than throwing.
   *
   * `false` means the unique index rejected it, which during an import is an
   * expected outcome and not an error: a second run over the same statement
   * should count duplicates, not fail.
   */
  insertImported(row: NewTransaction): Promise<boolean>;

  /** Re-file one transaction. `null` puts it back to uncategorised. */
  setCategory(transactionId: number, categoryId: number | null): Promise<void>;

  /**
   * Lines that could still turn out to be a leg of a transfer: not already
   * part of one, and inside the span worth looking at.
   *
   * A projection rather than whole rows. Pairing needs four fields, and after
   * a few years of statements the ones it will never match — every card
   * payment ever made — outnumber the ones it will by two orders of magnitude.
   */
  findUnlinkedLegs(from?: string | null, to?: string | null): Promise<TransferLeg[]>;

  /** The legs of one transfer, so unlinking can say what it let go of. */
  findByTransferGroup(groupId: string): Promise<TransactionRow[]>;

  /**
   * Attach these lines to one transfer, or detach them with `null`.
   * Resolves how many rows it changed.
   */
  setTransferGroup(transactionIds: number[], groupId: string | null): Promise<number>;

  /**
   * Detach every transaction from a category, for when that category is
   * deleted. There are no DB-level FKs, so `ON DELETE SET NULL` has to be
   * reproduced here or the rows keep pointing at an id that no longer exists.
   */
  clearCategory(categoryId: number): Promise<void>;
}
