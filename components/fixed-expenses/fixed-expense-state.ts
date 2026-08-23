import { STATUS } from "@shared/palette";
import { formatDateShort, formatMonthName } from "@shared/format";
import { EXPENSE_CADENCE_EVERY, type ExpenseCadence } from "@domain/enums";

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

/**
 * The schedule in a few words, for a list row.
 *
 * "le 15" is enough for a monthly charge and useless for a yearly one, where
 * the eleven months it is not due are the whole point.
 */
export function describeDue(
  fx: { cadence: ExpenseCadence; dueDay: number | null },
  nextDueDate: string | null,
): string {
  if (fx.cadence === "weekly") return "chaque semaine";
  if (fx.cadence === "monthly") return fx.dueDay ? `le ${fx.dueDay}` : "—";
  return nextDueDate ? formatDateShort(nextDueDate) : "—";
}

/**
 * The schedule as a sentence: "chaque trimestre, le 15, à partir de septembre".
 *
 * The anchor month has to be named for a quarterly charge and cannot be left to
 * read as the only month it falls in, which "le 15 septembre" would.
 */
export function describeSchedule(fx: {
  cadence: ExpenseCadence;
  dueDay: number | null;
  dueMonth: number | null;
}): string {
  const every = EXPENSE_CADENCE_EVERY[fx.cadence];
  if (fx.cadence === "weekly") return every;
  const day = fx.dueDay ? `, le ${fx.dueDay}` : "";
  if (fx.cadence === "yearly") {
    return `${every}${day}${fx.dueMonth ? ` ${formatMonthName(fx.dueMonth)}` : ""}`;
  }
  if (fx.cadence === "quarterly") {
    return `${every}${day}${fx.dueMonth ? `, à partir de ${formatMonthName(fx.dueMonth)}` : ""}`;
  }
  return `${every}${day}`;
}
