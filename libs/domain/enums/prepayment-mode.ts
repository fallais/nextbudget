/**
 * What the bank does with money paid ahead of the schedule.
 *
 * A French lender asks which one you want, and the choice is the whole
 * decision: the same euros either buy back months at the end of the loan, or
 * lower every instalment that is left. Shortening saves far more interest;
 * lowering the instalment frees up cash now.
 */
export const PREPAYMENT_MODES = ["duration", "payment"] as const;
export type PrepaymentMode = (typeof PREPAYMENT_MODES)[number];

export const PREPAYMENT_MODE_LABELS: Record<PrepaymentMode, string> = {
  duration: "Réduction de durée",
  payment: "Réduction de mensualité",
};
