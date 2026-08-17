import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import type { BudgetPeriod, Visibility } from "@domain/enums";

export interface BudgetRow {
  id: number;
  categoryId: number;
  ownerId: number | null;
  visibility: Visibility;
  amountCents: number;
  period: BudgetPeriod;
  createdAt: Date;
}

export type NewBudget = Omit<BudgetRow, "id" | "createdAt">;

/** Weeks per month, averaged over a year — 52/12, not 4. */
const WEEKS_PER_MONTH = 52 / 12;

export class Budget extends Entity<BudgetRow> {
  private constructor(row: BudgetRow) {
    super(row);
  }

  static reconstitute(row: BudgetRow): Budget {
    return new Budget(row);
  }

  static create(input: NewBudget): Budget {
    Money.positiveFromCents(input.amountCents);
    invariant(input.amountCents > 0, "Le budget doit être supérieur à zéro.", "budget.zero");
    return new Budget({ ...input, id: 0, createdAt: new Date() });
  }

  get categoryId(): number {
    return this.row.categoryId;
  }
  get amount(): Money {
    return Money.fromCents(this.row.amountCents);
  }

  /** Comparable figure across periods, for "reste à vivre". */
  get monthlyEquivalent(): Money {
    return this.row.period === "monthly"
      ? this.amount
      : this.amount.times(WEEKS_PER_MONTH);
  }

}
