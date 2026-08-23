/**
 * Recognising a move between two accounts you already own.
 *
 * Money leaving the current account for the livret is not spending: the
 * household is exactly as rich the day after. Yet both legs are real bank
 * lines, so summing the ledger books the debit as an expense and, once the
 * savings statement is imported too, the credit as income. A single 500 €
 * transfer then adds 1 000 € of movement that never happened, and every figure
 * built on it — the month's expenses, the category donut, the average income
 * the reste a vivre leans on — is wrong by that much.
 *
 * Pairing is the whole trick, and it is deliberately narrow: the same amount,
 * opposite signs, two different accounts, a few days apart. A bank posts the
 * two legs on the same day or one either side of a weekend, never a fortnight
 * apart, so a wide window would start marrying a purchase to an unrelated
 * refund. What is left ambiguous is left alone rather than guessed: each leg is
 * consumed by at most one pair, and a leg with no counterpart stays what it is.
 *
 * Pure, so the rule that quietly removes money from the spending figures can be
 * read and tested without a database anywhere near it.
 */

export type TransferLeg = {
  id: number;
  accountId: number;
  /** ISO yyyy-MM-dd, as stored: a bank line falls on a day, not an instant. */
  date: string;
  amountCents: number;
};

/** Two legs the pairing is confident about. */
export type TransferPair = { debitId: number; creditId: number };

/**
 * How far apart the two legs may land, in days.
 *
 * Four covers the usual case (same day) and the awkward one (out on Friday, in
 * on Tuesday) without reaching so far that two unrelated lines of the same
 * amount start looking like a couple.
 */
export const TRANSFER_WINDOW_DAYS = 4;

/** Days since the epoch, from an ISO date. Avoids a timezone ever entering. */
function dayNumber(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * Match debits to credits, each leg used at most once.
 *
 * Debits are taken oldest first and each takes the nearest eligible credit, so
 * the result depends on the input set and not on the order rows came back in.
 * Ties break on the lower id for the same reason.
 */
export function pairTransfers(
  legs: readonly TransferLeg[],
  windowDays: number = TRANSFER_WINDOW_DAYS,
): TransferPair[] {
  const byAmount = new Map<number, TransferLeg[]>();
  for (const leg of legs) {
    if (leg.amountCents <= 0) continue;
    const key = leg.amountCents;
    const bucket = byAmount.get(key);
    if (bucket) bucket.push(leg);
    else byAmount.set(key, [leg]);
  }

  const debits = legs
    .filter((l) => l.amountCents < 0)
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));

  const taken = new Set<number>();
  const pairs: TransferPair[] = [];

  for (const debit of debits) {
    const candidates = byAmount.get(-debit.amountCents);
    if (!candidates) continue;
    const debitDay = dayNumber(debit.date);

    let best: TransferLeg | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const credit of candidates) {
      if (taken.has(credit.id)) continue;
      // Same account means one line, not two: a statement that shows money
      // leaving and returning inside one account is a reversal, not a move.
      if (credit.accountId === debit.accountId) continue;
      const distance = Math.abs(dayNumber(credit.date) - debitDay);
      if (distance > windowDays) continue;
      if (distance < bestDistance || (distance === bestDistance && best !== null && credit.id < best.id)) {
        best = credit;
        bestDistance = distance;
      }
    }

    if (!best) continue;
    taken.add(best.id);
    pairs.push({ debitId: debit.id, creditId: best.id });
  }

  return pairs;
}

/** Why a set of transactions cannot be declared one transfer. */
export type TransferRefusal = "no_legs" | "already_linked" | "same_account";

/**
 * Whether these lines can be called a transfer, said by hand.
 *
 * One leg is allowed and is not a mistake: money sent to an account this app
 * does not hold still has to stop counting as spending, and there is no
 * counterpart row to find. What is refused is a set already spoken for, and a
 * set that never leaves its account.
 */
export function refuseTransfer(
  legs: readonly Pick<TransferLeg, "accountId">[],
  alreadyLinked: boolean,
): TransferRefusal | null {
  if (legs.length === 0) return "no_legs";
  if (alreadyLinked) return "already_linked";
  if (legs.length > 1 && new Set(legs.map((l) => l.accountId)).size === 1) return "same_account";
  return null;
}
