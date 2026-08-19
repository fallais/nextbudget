import { STATUS } from "@shared/palette";

/**
 * Each state gets a word as well as a colour — never the dot alone, because a
 * hue is unreadable to a colour-blind eye and at a glance.
 */
export const FIXED_EXPENSE_STATE = {
  paid: { label: "Payé", color: STATUS.good },
  pending: { label: "À venir", color: STATUS.warning },
  overdue: { label: "En retard", color: STATUS.critical },
  anomaly: { label: "Montant inhabituel", color: STATUS.serious },
} as const;

/** Worst first: the page exists for the exceptions, not for the settled ones. */
export const STATE_RANK = { overdue: 0, anomaly: 1, pending: 2, paid: 3 } as const;
