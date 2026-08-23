/**
 * How often a recurring charge comes round.
 *
 * A frais fixe used to be monthly by construction: an amount and a day of the
 * month, judged against the transactions of the current month. That quietly
 * excluded a whole class of the charges people most want tracked, because they
 * are the easy ones to forget: the taxe d'ordures ménagères once a year, the
 * water every quarter, the insurance premium every April.
 *
 * The same four values the detector reports, deliberately: a charge it spots
 * as quarterly has to be declarable as quarterly, or confirming a suggestion
 * would create a charge the app then reports as unpaid eight months a year.
 */
export const EXPENSE_CADENCES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type ExpenseCadence = (typeof EXPENSE_CADENCES)[number];

/** As the interface names them. A charge is feminine: *une* charge annuelle. */
export const EXPENSE_CADENCE_LABELS: Record<ExpenseCadence, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  yearly: "Annuelle",
};

/** How often it is taken, as the detail page and the list say it. */
export const EXPENSE_CADENCE_EVERY: Record<ExpenseCadence, string> = {
  weekly: "chaque semaine",
  monthly: "chaque mois",
  quarterly: "chaque trimestre",
  yearly: "chaque année",
};

/**
 * Months from one charge to the next. Weekly is zero because it is measured in
 * days, and the schedule handles it separately rather than pretending 0,23.
 */
export const CADENCE_MONTHS: Record<ExpenseCadence, number> = {
  weekly: 0,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** Cadences that need to know which month they fall in to be placed at all. */
export function needsDueMonth(cadence: ExpenseCadence): boolean {
  return cadence === "quarterly" || cadence === "yearly";
}
