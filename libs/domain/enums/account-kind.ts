/**
 * `personal` — one member's own account. `joint` — the household's common
 * account, the one contributions are paid into.
 *
 * Deliberately not derived from visibility: joint-ness is a fact about the bank
 * account itself, whereas visibility is about who may look at it. A personal
 * account can be shared without becoming the common pot.
 */
export const ACCOUNT_KINDS = ["personal", "joint"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
