import "server-only";
import { randomUUID } from "node:crypto";
import { addDays, formatISO, parseISO } from "date-fns";
import { transactions } from "@infrastructure/persistence/repositories";
import type { TransactionRepository } from "@domain/repositories";
import {
  pairTransfers,
  refuseTransfer,
  TRANSFER_WINDOW_DAYS,
  type TransferRefusal,
} from "@domain/services/transfers";

/**
 * Declaring, finding and undoing moves between your own accounts.
 *
 * Deliberately not scoped to who is looking, for the same reason
 * recategorising is not: a transfer is a fact about the ledger, not a view of
 * it. Pairing only what one member can see would mark the leg that leaves the
 * joint account and leave the one arriving in a private account counted as
 * income — half a pair is worse than either whole answer, because it makes the
 * household look richer by exactly the amount it moved.
 */

export type TransferDeps = {
  transactions: Pick<
    TransactionRepository,
    "findById" | "findUnlinkedLegs" | "findByTransferGroup" | "setTransferGroup"
  >;
  /** A fresh identifier per transfer. Injected so a test can read the wiring. */
  newGroupId: () => string;
};

const LIVE: TransferDeps = { transactions, newGroupId: () => randomUUID() };

export type LinkTransferResult =
  | { ok: true; groupId: string; legs: number }
  | { ok: false; reason: TransferRefusal | "not_found" };

/**
 * Say that these lines are one transfer.
 *
 * The refusals are the domain's (`refuseTransfer`); which HTTP status they
 * become is the edge's business.
 */
export async function linkTransfer(
  transactionIds: number[],
  deps: TransferDeps = LIVE,
): Promise<LinkTransferResult> {
  const ids = [...new Set(transactionIds)];
  const found = await Promise.all(ids.map((id) => deps.transactions.findById(id)));
  if (found.some((t) => t === null)) return { ok: false, reason: "not_found" };

  const rows = found.map((t) => t!.toRow());
  const refusal = refuseTransfer(rows, rows.some((r) => r.transferGroupId !== null));
  if (refusal) return { ok: false, reason: refusal };

  const groupId = deps.newGroupId();
  const legs = await deps.transactions.setTransferGroup(ids, groupId);
  return { ok: true, groupId, legs };
}

/** Put both legs back in the spending figures. `false` when no such transfer. */
export async function unlinkTransfer(
  groupId: string,
  deps: TransferDeps = LIVE,
): Promise<boolean> {
  const legs = await deps.transactions.findByTransferGroup(groupId);
  if (legs.length === 0) return false;
  await deps.transactions.setTransferGroup(
    legs.map((l) => l.id),
    null,
  );
  return true;
}

export type DetectTransfersResult = { pairs: number; legs: number };

/**
 * Find the pairs nobody has declared yet, over a span of dates or the whole
 * ledger.
 *
 * Each pair gets its own identifier, so undoing one says nothing about the
 * others. Runs after every import, and on demand from the transactions page
 * for statements that predate the feature.
 */
export async function detectTransfers(
  range?: { from: string; to: string } | null,
  deps: TransferDeps = LIVE,
): Promise<DetectTransfersResult> {
  // A leg imported today can answer one from a few days before the statement
  // starts, so the search is wider than the rows that triggered it.
  const from = range ? isoDate(addDays(parseISO(range.from), -TRANSFER_WINDOW_DAYS)) : null;
  const to = range ? isoDate(addDays(parseISO(range.to), TRANSFER_WINDOW_DAYS)) : null;

  const pairs = pairTransfers(await deps.transactions.findUnlinkedLegs(from, to));
  for (const pair of pairs) {
    await deps.transactions.setTransferGroup([pair.debitId, pair.creditId], deps.newGroupId());
  }
  return { pairs: pairs.length, legs: pairs.length * 2 };
}

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}
