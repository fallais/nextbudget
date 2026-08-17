/**
 * Where a month's contribution stands. Nothing received is `pending` rather
 * than an anomaly — the month may simply not be over yet.
 */
export const CONTRIBUTION_STATES = ["received", "pending", "anomaly"] as const;
export type ContributionState = (typeof CONTRIBUTION_STATES)[number];
