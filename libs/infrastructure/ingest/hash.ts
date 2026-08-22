import { createHash } from "node:crypto";

/**
 * The content fingerprint a re-import is recognised by.
 *
 * `occurrence` is what tells "I have seen this file before" apart from "these
 * two lines look alike" — two metro tickets, two coffees at the same café,
 * three identical `COMMISSION D'INTERVENTION` are one day, one amount and one
 * libellé repeated, and a statement is entitled to say so. They are the 0th,
 * 1st and 2nd occurrence of that fingerprint in the account, and each gets a
 * row.
 *
 * The 0th hashes to exactly what this returned before occurrences existed, so
 * rows written by an earlier version still match what an import computes for
 * them today — no rehash, no migration, and re-importing an old statement
 * stays the no-op it was.
 */
export function transactionHash(args: {
  date: string;
  amountCents: number;
  normalizedDescription: string;
  occurrence?: number;
}): string {
  const payload = `${args.date}|${args.amountCents}|${args.normalizedDescription}`;
  const withOccurrence = args.occurrence ? `${payload}|#${args.occurrence}` : payload;
  return createHash("sha256").update(withOccurrence).digest("hex");
}
