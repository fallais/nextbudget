import "server-only";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";

/**
 * Leaving moves between your own accounts out of the flow figures.
 *
 * The rule is one line of SQL; where it belongs is the part worth writing
 * down. A query answers one of two questions, and they want opposite things
 * from a transfer:
 *
 * - "What did the household earn and spend?" — leave it out. Sending 500 € to
 *   the livret is not an expense, and the 500 € landing there is not income.
 *   Counting both adds 1 000 € of movement to a month in which nothing was
 *   earned and nothing was bought.
 * - "What is in this account, and what does the statement say?" — keep it. The
 *   money really did leave the current account, and a balance that pretended
 *   otherwise would disagree with the bank.
 *
 * So balances, the ledger and its export keep transfers; the period summary,
 * the category breakdown, the monthly bars and the reste a vivre drop them.
 * Apports keep them too, and that is not an oversight: an apport *is* a
 * transfer between household accounts, and matching one is the whole point of
 * the page.
 */
export function excludeTransfers<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
): SelectQueryBuilder<T> {
  return qb.andWhere(`${alias}.transfer_group_id IS NULL`);
}
