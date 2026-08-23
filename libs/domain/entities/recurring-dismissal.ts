import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";

export interface RecurringDismissalRow {
  id: number;
  /** The recurrence key, as `recurrenceKey()` builds it: "edf", "netflix.com". */
  key: string;
  createdAt: Date;
}

export type NewRecurringDismissal = Omit<RecurringDismissalRow, "id" | "createdAt">;

/**
 * A repeating charge the app was told to stop offering.
 *
 * Detection runs over the whole ledger every time the page is opened, so a
 * suggestion turned down would come straight back on the next visit. A list
 * that keeps proposing what you have already refused stops being read, and
 * then the one suggestion that mattered is missed with the rest.
 *
 * Stored as what you refused, not as a copy of the suggestion: keeping the key
 * alone means restoring it is a delete, and the amounts and dates behind it
 * stay live in the meantime.
 */
export class RecurringDismissal extends Entity<RecurringDismissalRow> {
  private constructor(row: RecurringDismissalRow) {
    super(row);
  }

  static reconstitute(row: RecurringDismissalRow): RecurringDismissal {
    return new RecurringDismissal(row);
  }

  static create(input: NewRecurringDismissal): RecurringDismissal {
    invariant(
      input.key.trim().length > 0,
      "La charge à ignorer est obligatoire.",
      "recurring_dismissal.key_required",
    );
    return new RecurringDismissal({ ...input, id: 0, createdAt: new Date() });
  }

  get key(): string {
    return this.row.key;
  }
}
