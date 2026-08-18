import "server-only";
import { accounts, transactions } from "@infrastructure/persistence/repositories";

/**
 * Account use cases that are more than a single repository call.
 */

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "has_transactions"; count: number };

/**
 * Deleting an account is refused while it still holds transactions.
 *
 * There are no DB-level FK constraints, so nothing at the database layer would
 * stop this — the rows would simply be orphaned, still counted by every
 * aggregate but attached to an account that no longer exists. Refusing and
 * saying how many is the recoverable behaviour.
 */
export async function deleteAccount(accountId: number): Promise<DeleteAccountResult> {
  const account = await accounts.findById(accountId);
  if (!account) return { ok: false, reason: "not_found" };

  const count = await transactions.countByAccount(accountId);
  if (count > 0) return { ok: false, reason: "has_transactions", count };

  await accounts.delete(accountId);
  return { ok: true };
}
