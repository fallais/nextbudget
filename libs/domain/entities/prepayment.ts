import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import type { PrepaymentMode } from "@domain/enums";

export interface PrepaymentRow {
  id: number;
  /** The loan this was paid against. */
  assetId: number;
  date: string;
  /** Capital repaid ahead of the schedule. Never the instalment itself. */
  amountCents: number;
  mode: PrepaymentMode;
  /** Indemnité de remboursement anticipé, when the lender charged one. */
  feesCents: number | null;
  notes: string | null;
  createdAt: Date;
}

export type NewPrepayment = Omit<PrepaymentRow, "id" | "createdAt">;

/**
 * Capital paid off ahead of the schedule.
 *
 * Kept as its own row rather than folded into the loan's remaining balance,
 * because the schedule has to be rebuilt around it: everything after the date
 * changes — the interest, the number of instalments left, and possibly the
 * instalment itself. A balance typed in by hand would be right for one day and
 * wrong every day after.
 */
export class Prepayment extends Entity<PrepaymentRow> {
  private constructor(row: PrepaymentRow) {
    super(row);
  }

  static reconstitute(row: PrepaymentRow): Prepayment {
    return new Prepayment(row);
  }

  static create(input: NewPrepayment): Prepayment {
    Money.positiveFromCents(input.amountCents);
    invariant(
      input.amountCents > 0,
      "Le montant remboursé doit être supérieur à zéro.",
      "prepayment.amount_required",
    );
    invariant(
      /^\d{4}-\d{2}-\d{2}$/.test(input.date),
      "La date est obligatoire.",
      "prepayment.date_required",
    );
    if (input.feesCents != null) Money.positiveFromCents(input.feesCents);
    return new Prepayment({ ...input, id: 0, createdAt: new Date() });
  }

  get assetId(): number {
    return this.row.assetId;
  }
}
