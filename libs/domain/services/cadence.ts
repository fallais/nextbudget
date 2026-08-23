import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  endOfWeek,
  formatISO,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CADENCE_MONTHS, type ExpenseCadence } from "@domain/enums";

/**
 * When a recurring charge is due, and which stretch of the ledger answers for it.
 *
 * The question a frais fixe exists to answer is "has this been taken yet", and
 * that only means something inside a window. For a monthly charge the window is
 * the month, which is why the whole thing used to be written as if the month
 * were the only unit there is. It is not: the taxe d'ordures ménagères is taken
 * once a year, and judged against the current month it reads as eleven months
 * of arrears followed by one month of relief.
 *
 * So every cadence gets the same treatment. A period runs from the start of a
 * cycle to the day before the next one begins, the charge falls due on a stated
 * day inside it, and it is late only once that day has passed by a margin. One
 * rule, four cadences, and nothing about it privileges the calendar month.
 *
 * Pure: the arithmetic that decides whether you owe money should be readable
 * without a database in the room.
 */

export type Schedule = {
  cadence: ExpenseCadence;
  /**
   * Day of the month it lands on, 1-31. Null when it was never stated, and
   * meaningless for a weekly charge, which is placed by its week.
   */
  dueDay: number | null;
  /**
   * The month it falls in, 1-12. What anchors a quarterly or yearly charge:
   * without it, "every three months" does not say which three.
   */
  dueMonth: number | null;
};

export type Period = {
  /** ISO yyyy-MM-dd, inclusive both ends. */
  start: string;
  end: string;
  /** The day it is expected. Null when the charge never said which day. */
  dueDate: string | null;
};

/** Days after the due date before a charge is called late, not merely awaited. */
export const OVERDUE_GRACE_DAYS = 5;

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** The day-of-month clamped to a month that may not have it. February has no 31st. */
function dayIn(month: Date, dueDay: number | null): Date | null {
  if (dueDay === null) return null;
  return new Date(month.getFullYear(), month.getMonth(), Math.min(dueDay, getDaysInMonth(month)));
}

/**
 * The cycle this date falls inside, as the month it starts in.
 *
 * Quarterly and yearly charges are anchored on `dueMonth`: a water bill
 * anchored in January belongs to cycles starting in January, April, July and
 * October, and today's cycle is the most recent of those that has begun.
 */
function cycleStart(schedule: Schedule, today: Date): Date {
  const step = CADENCE_MONTHS[schedule.cadence];
  if (step <= 1) return startOfMonth(today);

  const anchor = new Date(today.getFullYear(), (schedule.dueMonth ?? 1) - 1, 1);
  // How many whole steps separate the anchor from now, floored so that a date
  // before the anchor's first cycle walks backwards into the previous one.
  const months = differenceInCalendarMonths(startOfMonth(today), anchor);
  return addMonths(anchor, Math.floor(months / step) * step);
}

/**
 * The window the charge belongs to right now, and when it falls due in it.
 *
 * Weekly charges are the exception the calendar forces: a week is not a number
 * of months, so it is measured in days, Monday to Sunday, and has no day of the
 * month to be due on.
 */
export function currentPeriod(schedule: Schedule, today: string): Period {
  const day = parseISO(today);

  if (schedule.cadence === "weekly") {
    return {
      start: isoDate(startOfWeek(day, { weekStartsOn: 1 })),
      end: isoDate(endOfWeek(day, { weekStartsOn: 1 })),
      // A weekly charge has no day of the month; it is late when the week is
      // out, which the window itself already says.
      dueDate: null,
    };
  }

  const start = cycleStart(schedule, day);
  const next = addMonths(start, CADENCE_MONTHS[schedule.cadence]);
  const due = dayIn(start, schedule.dueDay);
  return {
    start: isoDate(start),
    end: isoDate(addDays(next, -1)),
    dueDate: due ? isoDate(due) : null,
  };
}

/**
 * The next time it falls due, strictly after `after`.
 *
 * What a projection walks. Null when the charge never said which day, since
 * placing it would be inventing the date rather than reading it.
 */
export function nextDueDate(schedule: Schedule, after: string): string | null {
  if (schedule.cadence === "weekly") {
    // Weekly charges have no stated day, so the honest next one is a week from
    // the start of the current week.
    return isoDate(addDays(startOfWeek(parseISO(after), { weekStartsOn: 1 }), 7));
  }
  if (schedule.dueDay === null) return null;

  const step = CADENCE_MONTHS[schedule.cadence];
  let month = cycleStart(schedule, parseISO(after));
  // At most a full extra cycle: one step past the current one always clears it.
  for (let i = 0; i < 3; i++) {
    const due = dayIn(month, schedule.dueDay);
    if (due && isoDate(due) > after) return isoDate(due);
    month = addMonths(month, step);
  }
  return null;
}

/** Weeks per month, averaged over a year. The same 52/12 a weekly budget uses. */
const WEEKS_PER_MONTH = 52 / 12;

/**
 * What this costs a month, whatever its cadence.
 *
 * The only figure that lets a weekly, a monthly and a yearly charge be added
 * together, which is what the reste à vivre does: a 150 euro premium taken once
 * a year commits 12,50 a month, and counting it as 150 would report a household
 * with no room left that has plenty.
 */
export function monthlyShareCents(cents: number, cadence: ExpenseCadence): number {
  switch (cadence) {
    case "weekly":
      return Math.round(cents * WEEKS_PER_MONTH);
    case "monthly":
      return cents;
    case "quarterly":
      return Math.round(cents / 3);
    case "yearly":
      return Math.round(cents / 12);
  }
}

/** What it costs a year, for a page comparing charges of different cadences. */
export function yearlyShareCents(cents: number, cadence: ExpenseCadence): number {
  return cadence === "weekly" ? Math.round(cents * 52) : Math.round((cents * 12) / CADENCE_MONTHS[cadence]);
}
