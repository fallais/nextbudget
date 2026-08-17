/**
 * Fractional ownership maths, in basis points (10000 = 100%).
 *
 * Pure and DB-free so it can be unit-tested. The invariant that shares for one
 * asset sum to exactly 10000 is enforced here rather than by a DB constraint,
 * matching the project's no-FK/no-check-constraint convention.
 */

export const TOTAL_BPS = 10_000;

export type ShareInput = { personId: number; shareBps: number };

export type ShareError =
  | { code: "empty" }
  | { code: "duplicate_person"; personId: number }
  | { code: "out_of_range"; personId: number; shareBps: number }
  | { code: "bad_total"; totalBps: number };

/** French message for a share validation failure. */
export function shareErrorMessage(e: ShareError): string {
  switch (e.code) {
    case "empty":
      return "Indiquez au moins un propriétaire.";
    case "duplicate_person":
      return "Une même personne ne peut apparaître qu'une fois.";
    case "out_of_range":
      return "Chaque quote-part doit être comprise entre 0,01 % et 100 %.";
    case "bad_total":
      return `Le total des quotes-parts doit faire 100 % (actuellement ${formatBps(e.totalBps)}).`;
  }
}

export function validateShares(owners: ShareInput[]): ShareError | null {
  if (owners.length === 0) return { code: "empty" };
  const seen = new Set<number>();
  let total = 0;
  for (const o of owners) {
    if (seen.has(o.personId)) return { code: "duplicate_person", personId: o.personId };
    seen.add(o.personId);
    if (!Number.isInteger(o.shareBps) || o.shareBps <= 0 || o.shareBps > TOTAL_BPS) {
      return { code: "out_of_range", personId: o.personId, shareBps: o.shareBps };
    }
    total += o.shareBps;
  }
  if (total !== TOTAL_BPS) return { code: "bad_total", totalBps: total };
  return null;
}

/** A person's slice of an amount, rounded to the cent. */
export function applyShare(valueCents: number, shareBps: number): number {
  return Math.round((valueCents * shareBps) / TOTAL_BPS);
}

/** `5000` → `"50 %"`, `6250` → `"62,5 %"`. */
export function formatBps(shareBps: number): string {
  const pct = shareBps / 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, "");
  return `${text.replace(".", ",")} %`;
}

/**
 * Split `10000` across `n` people as evenly as integer basis points allow,
 * giving any remainder to the first. Used by the "shared equally" preset.
 */
export function evenShares(personIds: number[]): ShareInput[] {
  if (personIds.length === 0) return [];
  const base = Math.floor(TOTAL_BPS / personIds.length);
  const remainder = TOTAL_BPS - base * personIds.length;
  return personIds.map((personId, i) => ({
    personId,
    shareBps: i === 0 ? base + remainder : base,
  }));
}
