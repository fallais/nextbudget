import type {
  RecurringDismissal,
  RecurringDismissalRow,
  NewRecurringDismissal,
} from "@domain/entities";
import type { Repository } from "./repository";

export interface RecurringDismissalRepository
  extends Repository<RecurringDismissal, RecurringDismissalRow, NewRecurringDismissal> {
  /** So that refusing the same suggestion twice stays one refusal. */
  findByKey(key: string): Promise<RecurringDismissal | null>;

  /** Offer it again. `false` when it was not being hidden in the first place. */
  deleteByKey(key: string): Promise<boolean>;
}
