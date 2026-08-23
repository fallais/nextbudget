import "server-only";
import { recurringDismissals } from "@infrastructure/persistence/repositories";
import type { RecurringDismissalRepository } from "@domain/repositories";

/**
 * Repeating charges the app noticed: the read models, plus the two decisions
 * a person can take about them.
 *
 * Confirming one is not here, and that is deliberate: a confirmed suggestion
 * is a frais fixe, created the same way a typed one is, through
 * `@application/fixed-expenses`. Nothing links the two, because nothing needs
 * to: a charge stops being suggested the moment a frais fixe matches it.
 */
export * from "@infrastructure/persistence/queries/recurring";

export type RecurringDeps = {
  dismissals: Pick<RecurringDismissalRepository, "findByKey" | "create" | "deleteByKey">;
};

const LIVE: RecurringDeps = { dismissals: recurringDismissals };

/**
 * Stop offering this one.
 *
 * Idempotent: refusing twice is one refusal, and a second click returning a
 * conflict would be an error message for doing nothing wrong.
 */
export async function dismissRecurring(key: string, deps: RecurringDeps = LIVE): Promise<void> {
  if (await deps.dismissals.findByKey(key)) return;
  await deps.dismissals.create({ key });
}

/** Offer it again. `false` when it was not being hidden. */
export async function restoreRecurring(
  key: string,
  deps: RecurringDeps = LIVE,
): Promise<boolean> {
  return deps.dismissals.deleteByKey(key);
}
