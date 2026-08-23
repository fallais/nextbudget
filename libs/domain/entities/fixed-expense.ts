import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import { needsDueMonth, type ExpenseCadence, type PersonMatchType, type Visibility } from "@domain/enums";

export interface FixedExpenseRow {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  name: string;
  categoryId: number | null;
  /** The loan this instalment services, when it is one. */
  liabilityId: number | null;
  expectedAmountCents: number;
  tolerancePct: number;
  /**
   * How often it comes round.
   *
   * The amount is per occurrence, not per month: a yearly premium of 150 euros
   * stores 15000 and cadence "yearly". Anything adding charges together has to
   * put them on one footing first (`monthlyShareCents`), and anything asking
   * whether it has been paid has to ask inside its own window
   * (`currentPeriod`), never inside the calendar month.
   */
  cadence: ExpenseCadence;
  /** Day of the month it lands on. Meaningless for a weekly charge. */
  dueDay: number | null;
  /**
   * The month it falls in, 1-12. What anchors a quarterly or yearly charge:
   * "every three months" does not say which three.
   */
  dueMonth: number | null;
  matchPattern: string;
  matchType: PersonMatchType;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export type NewFixedExpense = Omit<FixedExpenseRow, "id" | "createdAt">;

/** A recurring obligation: rent, energy, insurance, a loan instalment. */
export class FixedExpense extends Entity<FixedExpenseRow> {
  private constructor(row: FixedExpenseRow) {
    super(row);
  }

  static reconstitute(row: FixedExpenseRow): FixedExpense {
    return new FixedExpense(row);
  }

  static create(input: NewFixedExpense): FixedExpense {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "fixed_expense.name_required");
    invariant(
      input.matchPattern.trim().length > 0,
      "Le motif de rapprochement est obligatoire.",
      "fixed_expense.pattern_required",
    );
    Money.positiveFromCents(input.expectedAmountCents);
    if (input.dueDay != null) {
      invariant(
        input.dueDay >= 1 && input.dueDay <= 31,
        "Le jour d'échéance doit être compris entre 1 et 31.",
        "fixed_expense.due_day_invalid",
      );
    }
    if (input.dueMonth != null) {
      invariant(
        input.dueMonth >= 1 && input.dueMonth <= 12,
        "Le mois d'échéance doit être compris entre 1 et 12.",
        "fixed_expense.due_month_invalid",
      );
    }
    // Without it there is no way to place the charge: a quarterly bill could be
    // January-April-July or February-May-August, and guessing would report a
    // household in arrears on a bill that is not due for another two months.
    invariant(
      !needsDueMonth(input.cadence) || input.dueMonth != null,
      "Une charge trimestrielle ou annuelle doit indiquer le mois de l'échéance.",
      "fixed_expense.due_month_required",
    );
    return new FixedExpense({ ...input, id: 0, createdAt: new Date() });
  }

  get isActive(): boolean {
    return this.row.isActive;
  }
  get cadence(): ExpenseCadence {
    return this.row.cadence;
  }
  get expected(): Money {
    return Money.fromCents(this.row.expectedAmountCents);
  }

}
