/** How a pattern is compared against a normalised transaction description. */
export const MATCH_TYPES = ["contains", "equals", "starts_with", "regex"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

/** Person, contribution and fixed-expense matching never needs `equals`. */
export const PERSON_MATCH_TYPES = ["contains", "starts_with", "regex"] as const;
export type PersonMatchType = (typeof PERSON_MATCH_TYPES)[number];

/** Restricts a rule to money in, money out, or either. */
export const AMOUNT_CONDITIONS = ["any", "positive", "negative"] as const;
export type AmountCondition = (typeof AMOUNT_CONDITIONS)[number];
