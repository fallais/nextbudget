import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import type { PersonMatchType, Visibility } from "@domain/enums";

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
  dueDay: number | null;
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
    return new FixedExpense({ ...input, id: 0, createdAt: new Date() });
  }

  get isActive(): boolean {
    return this.row.isActive;
  }
  get expected(): Money {
    return Money.fromCents(this.row.expectedAmountCents);
  }

}
