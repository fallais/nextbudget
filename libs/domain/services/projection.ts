import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";

/**
 * What the balance does between now and the end of the month.
 *
 * Every other figure in the app looks backwards. This one answers the question
 * people actually open a budget app to ask: does this hold until payday. The
 * ingredients were all already here, and none of them were pointed forwards.
 *
 * The arithmetic is a walk, one day at a time, and the shape of the input is
 * where the honesty lives. Anything identifiable on a statement arrives as a
 * dated flow: a frais fixe has a pattern and a due day, so it is scheduled on
 * the day it is taken. Everything else, the shopping and the coffees and the
 * fuel, is a daily average, because nobody knows which Tuesday the big shop
 * lands on and pretending to would be false precision.
 *
 * The rule those two halves must obey is that nothing is counted twice: a
 * charge scheduled here has to be kept out of the average, which is the
 * caller's job and the reason the average arrives as a single figure rather
 * than being derived in this file.
 *
 * Pure, and the low point is the whole point: the end-of-month figure can look
 * comfortable while the account goes under on the 27th.
 */

export type ScheduledFlow = {
  label: string;
  /** Signed as the ledger is: negative leaves, positive arrives. */
  amountCents: number;
  /** ISO yyyy-MM-dd. */
  date: string;
};

export type ProjectionPoint = {
  date: string;
  balanceCents: number;
};

export type Projection = {
  /** One point per day, `from` to `to` inclusive, closing balance. */
  points: ProjectionPoint[];
  endBalanceCents: number;
  /** The worst day, which is rarely the last one. */
  low: ProjectionPoint;
  /** Magnitudes, for the breakdown under the chart. */
  scheduledOutCents: number;
  scheduledInCents: number;
  discretionaryCents: number;
  /** What is still to come, soonest first. */
  upcoming: ScheduledFlow[];
};

export type ProjectionInput = {
  from: string;
  to: string;
  startingBalanceCents: number;
  flows: readonly ScheduledFlow[];
  /**
   * Everyday spending, per day, as a positive figure. Whatever is not
   * scheduled: it is an average precisely because its timing is unknowable.
   */
  dailyDiscretionaryCents: number;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export function projectBalance(input: ProjectionInput): Projection {
  const { from, to, startingBalanceCents, dailyDiscretionaryCents } = input;

  const byDate = new Map<string, ScheduledFlow[]>();
  for (const flow of input.flows) {
    // A flow dated before the window still has to land: an unpaid charge whose
    // due day has gone by is money about to leave, not money saved.
    const date = flow.date < from ? from : flow.date;
    if (date > to) continue;
    const bucket = byDate.get(date);
    if (bucket) bucket.push(flow);
    else byDate.set(date, [flow]);
  }

  const days = Math.max(0, differenceInCalendarDays(parseISO(to), parseISO(from)));
  const points: ProjectionPoint[] = [];
  let balance = startingBalanceCents;
  let scheduledOut = 0;
  let scheduledIn = 0;
  let discretionary = 0;
  let low: ProjectionPoint = { date: from, balanceCents: startingBalanceCents };

  for (let i = 0; i <= days; i++) {
    const date = isoDate(addDays(parseISO(from), i));
    for (const flow of byDate.get(date) ?? []) {
      balance += flow.amountCents;
      if (flow.amountCents < 0) scheduledOut += -flow.amountCents;
      else scheduledIn += flow.amountCents;
    }
    balance -= dailyDiscretionaryCents;
    discretionary += dailyDiscretionaryCents;

    const point = { date, balanceCents: balance };
    points.push(point);
    if (point.balanceCents < low.balanceCents) low = point;
  }

  return {
    points,
    endBalanceCents: balance,
    low,
    scheduledOutCents: scheduledOut,
    scheduledInCents: scheduledIn,
    discretionaryCents: discretionary,
    upcoming: [...byDate.values()]
      .flat()
      .sort((a, b) => (a.date === b.date ? b.amountCents - a.amountCents : a.date < b.date ? -1 : 1)),
  };
}
