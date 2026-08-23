import "server-only";
import { accounts, transactions } from "@infrastructure/persistence/repositories";

import type { z } from "zod";
import type { accountInputSchema } from "./contracts/validation";
import type { Repository } from "@domain/repositories";
import type { Account, AccountRow, NewAccount } from "@domain/entities";
import { getCurrentUser } from "./auth";

/**
 * Everything the app does to an account.
 */

type AccountRepo = Repository<Account, AccountRow, NewAccount>;

export type AccountDeps = {
  accounts: Pick<AccountRepo, "findById" | "create" | "update" | "delete">;
  transactions: Pick<typeof transactions, "countByAccount">;
  currentUserId: () => Promise<number | null>;
};

const LIVE: AccountDeps = {
  accounts,
  transactions,
  currentUserId: async () => (await getCurrentUser())?.id ?? null,
};

export type AccountInput = z.infer<typeof accountInputSchema>;

/**
 * A new account, stamped with an owner.
 *
 * An explicit owner wins; otherwise it belongs to whoever created it, matching
 * how rules, contributions and assets are stamped. That rule lived in the route
 * handler, which is the one place it could not be tested or reused.
 */
export async function createAccount(
  input: AccountInput,
  deps: AccountDeps = LIVE,
): Promise<AccountRow> {
  const created = await deps.accounts.create({
    name: input.name,
    kind: input.kind,
    bank: input.bank ?? null,
    iban: input.iban ?? null,
    currency: input.currency,
    openingBalanceCents: input.openingBalanceCents ?? null,
    openingBalanceDate: input.openingBalanceDate ?? null,
    visibility: input.visibility,
    ownerId: input.ownerId ?? (await deps.currentUserId()),
  });
  return created.toRow();
}

/** Resolves `null` when no account has that id. */
export async function updateAccount(
  accountId: number,
  patch: Partial<AccountInput>,
  deps: AccountDeps = LIVE,
): Promise<AccountRow | null> {
  const updated = await deps.accounts.update(accountId, patch);
  return updated?.toRow() ?? null;
}

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
export async function deleteAccount(
  accountId: number,
  deps: AccountDeps = LIVE,
): Promise<DeleteAccountResult> {
  const account = await deps.accounts.findById(accountId);
  if (!account) return { ok: false, reason: "not_found" };

  const count = await deps.transactions.countByAccount(accountId);
  if (count > 0) return { ok: false, reason: "has_transactions", count };

  await deps.accounts.delete(accountId);
  return { ok: true };
}
