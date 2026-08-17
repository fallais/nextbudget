import { DomainError, invariant } from "@domain/errors";

/**
 * Fractional ownership, in basis points (10000 = 100%).
 *
 * Basis points rather than a float percentage so a 60/40 split is exactly
 * 6000/4000 and always totals 10000 — a percentage stored as 0.6 + 0.4 does
 * not reliably total 1. Matches the existing `interestRateBps` convention.
 */
export const TOTAL_BPS = 10_000;

export class Share {
  private constructor(readonly bps: number) {}

  static fromBps(bps: number): Share {
    invariant(
      Number.isInteger(bps) && bps > 0 && bps <= TOTAL_BPS,
      "Chaque quote-part doit être comprise entre 0,01 % et 100 %.",
      "share.out_of_range",
    );
    return new Share(bps);
  }

  /** From a percentage as typed by a user: 62.5 → 6250 bps. */
  static fromPercent(percent: number): Share {
    return Share.fromBps(Math.round(percent * 100));
  }

  static readonly whole = new Share(TOTAL_BPS);

  get isWhole(): boolean {
    return this.bps === TOTAL_BPS;
  }

  /** `5000` → `"50 %"`, `6250` → `"62,5 %"`. */
  format(): string {
    const pct = this.bps / 100;
    const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, "");
    return `${text.replace(".", ",")} %`;
  }

  /** This share of an amount, rounded to the cent. */
  applyTo(valueCents: number): number {
    return Math.round((valueCents * this.bps) / TOTAL_BPS);
  }

  equals(other: Share): boolean {
    return this.bps === other.bps;
  }
}

export type OwnerShare = { personId: number; share: Share };

/** Plain form, for HTTP payloads and persistence. */
export type OwnerShareRow = { personId: number; shareBps: number };

/**
 * Who owns one thing, and in what proportion.
 *
 * The invariant — shares total exactly 100%, each person appearing once — is a
 * property of the whole set, so it lives on the collection rather than on
 * Share. Enforced here because the database has no check constraints.
 */
export class Ownership {
  private constructor(readonly shares: readonly OwnerShare[]) {}

  static fromRows(rows: readonly OwnerShareRow[]): Ownership {
    invariant(rows.length > 0, "Indiquez au moins un propriétaire.", "ownership.empty");

    const seen = new Set<number>();
    let total = 0;
    const shares: OwnerShare[] = [];
    for (const row of rows) {
      if (seen.has(row.personId)) {
        throw new DomainError(
          "Une même personne ne peut apparaître qu'une fois.",
          "ownership.duplicate_person",
        );
      }
      seen.add(row.personId);
      const share = Share.fromBps(row.shareBps);
      total += share.bps;
      shares.push({ personId: row.personId, share });
    }

    if (total !== TOTAL_BPS) {
      throw new DomainError(
        `Le total des quotes-parts doit faire 100 % (actuellement ${formatBps(total)}).`,
        "ownership.bad_total",
      );
    }
    return new Ownership(shares);
  }

  /** Split evenly, giving the indivisible remainder to the first person. */
  static even(personIds: readonly number[]): Ownership {
    invariant(personIds.length > 0, "Indiquez au moins un propriétaire.", "ownership.empty");
    const base = Math.floor(TOTAL_BPS / personIds.length);
    const remainder = TOTAL_BPS - base * personIds.length;
    return Ownership.fromRows(
      personIds.map((personId, i) => ({
        personId,
        shareBps: i === 0 ? base + remainder : base,
      })),
    );
  }

  /** One person owns all of it. */
  static sole(personId: number): Ownership {
    return new Ownership([{ personId, share: Share.whole }]);
  }

  shareFor(personId: number): Share | null {
    return this.shares.find((s) => s.personId === personId)?.share ?? null;
  }

  toRows(): OwnerShareRow[] {
    return this.shares.map((s) => ({ personId: s.personId, shareBps: s.share.bps }));
  }
}

/**
 * Render any basis-point figure, including the invalid totals that only appear
 * in error messages and in the form's running total.
 */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, "");
  return `${text.replace(".", ",")} %`;
}
