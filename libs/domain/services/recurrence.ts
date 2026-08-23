import { addDays, addMonths, differenceInCalendarDays, formatISO, parseISO } from "date-fns";

/**
 * How a repeating charge behaves: whether it repeats at all, when the next one
 * is due, and whether the amount has moved.
 *
 * Two screens lean on this and they ask opposite questions. Frais fixes are
 * charges you declared, and what you want to know is what they have done to
 * you since: the water was 42 euros a quarter and is now 51. Suggestions are
 * the charges you never declared, and the question is whether a merchant that
 * appears three times is a subscription or a coincidence.
 *
 * Timing decides recurrence, never the amount. EDF varies every month and is
 * as recurring as a charge gets; a round 20 euros appearing four times in a
 * fortnight is not. So the cadence comes from the gaps between dates, and what
 * the amount has done is reported separately.
 *
 * Everything here is a suggestion, not a decision: nothing is written from it
 * without someone confirming, which is what lets it use heuristics at all.
 * Pure, and tested against real bank labels.
 */

export type Occurrence = { date: string; amountCents: number };

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

type CadenceSpec = { cadence: Cadence; minDays: number; maxDays: number; months: number };

/**
 * The windows a gap has to fall in. Wide enough for a direct debit that lands
 * on the next working day, narrow enough that monthly and quarterly cannot be
 * confused for one another.
 */
const CADENCES: readonly CadenceSpec[] = [
  { cadence: "weekly", minDays: 6, maxDays: 8, months: 0 },
  { cadence: "monthly", minDays: 25, maxDays: 36, months: 1 },
  { cadence: "quarterly", minDays: 80, maxDays: 100, months: 3 },
  { cadence: "yearly", minDays: 330, maxDays: 400, months: 12 },
];

/** Share of the gaps that must sit inside the window for the cadence to hold. */
const CONSISTENCY = 0.6;

export type Recurrence = {
  cadence: Cadence;
  occurrences: number;
  /**
   * The typical amount, as an absolute value.
   *
   * The middle observed amount rather than the mean: one catch-up bill twice
   * the usual size would drag an average with it and describe a charge that
   * has never once been taken.
   */
  medianAmountCents: number;
  /** Day of the month it lands on. Null when the cadence is weekly. */
  dueDay: number | null;
  firstDate: string;
  lastDate: string;
  /** The one after `lastDate`, which is what a projection needs. */
  nextDate: string;
};

/** Bank verbiage, and the words that change every month for no reason. */
const NOISE = new Set([
  "CARTE", "CB", "ACHAT", "ACHATS", "PAIEMENT", "PAIMT", "FACTURE", "FACT",
  "PRLV", "PRELEVEMENT", "PRELVT", "PREL", "SEPA", "DEBIT", "TIP",
  "VIR", "VIREMENT", "VRST", "VERSEMENT", "RECU", "EMIS", "MANDAT", "REF",
  "ECH", "ECHEANCE", "COTISATION", "COTIS", "AVIS", "NUM", "CLIENT", "CONTRAT",
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT",
  "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
  "JANV", "FEVR", "AVR", "JUIL", "SEPT", "OCT", "NOV", "DEC",
]);

/** Meaningful words to keep. Past four, a label is describing this one payment. */
const KEY_TOKENS = 4;

/**
 * A stable name for the thing being charged, from one bank label.
 *
 * "PRLV SEPA EDF 4837291" and "PRLV SEPA EDF 5012884" are the same charge, and
 * grouping on the label as stored would call them two. So the reference
 * numbers go (anything holding a digit), the bank's own vocabulary goes, and
 * so do month names, which is what otherwise splits a standing order into
 * twelve merchants called "LOYER JANVIER", "LOYER FEVRIER"...
 *
 * Returns null when nothing recognisable is left, which is the honest answer
 * for a label that is only a reference number.
 */
export function recurrenceKey(normalizedDescription: string): string | null {
  const tokens = normalizedDescription
    .split(" ")
    .filter((t) => t.length >= 3 && !/\d/.test(t) && !NOISE.has(t));
  if (tokens.length === 0) return null;
  return tokens.slice(0, KEY_TOKENS).join(" ").toLowerCase();
}

/** The middle value: always one that actually happened, unlike a mean. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** Move one cadence forward. Month arithmetic clamps, so the 31st survives February. */
function step(date: string, spec: CadenceSpec): string {
  const d = parseISO(date);
  return isoDate(spec.months === 0 ? addDays(d, 7) : addMonths(d, spec.months));
}

function specOf(cadence: Cadence): CadenceSpec {
  return CADENCES.find((c) => c.cadence === cadence)!;
}

/**
 * Whether these charges repeat, and how.
 *
 * Null means "not established", which is the answer wanted far more often than
 * a guess: three occurrences at random intervals is a merchant you visit, not
 * a subscription. A yearly charge is allowed on two occurrences because
 * insurance renews once and two is all anyone has; everything shorter needs
 * three, so that at least two gaps agree with each other.
 */
export function detectRecurrence(occurrences: readonly Occurrence[]): Recurrence | null {
  if (occurrences.length < 2) return null;
  const sorted = [...occurrences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(differenceInCalendarDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date)));
  }

  const middle = median(gaps);
  const spec = CADENCES.find((c) => middle >= c.minDays && middle <= c.maxDays);
  if (!spec) return null;

  const agreeing = gaps.filter((g) => g >= spec.minDays && g <= spec.maxDays).length;
  if (agreeing / gaps.length < CONSISTENCY) return null;

  const minimum = spec.cadence === "yearly" ? 2 : 3;
  if (sorted.length < minimum) return null;

  const last = sorted[sorted.length - 1];
  return {
    cadence: spec.cadence,
    occurrences: sorted.length,
    medianAmountCents: median(sorted.map((o) => Math.abs(o.amountCents))),
    dueDay: spec.cadence === "weekly" ? null : median(sorted.map((o) => Number(o.date.slice(8, 10)))),
    firstDate: sorted[0].date,
    lastDate: last.date,
    nextDate: step(last.date, spec),
  };
}

/**
 * When this charge is expected between two dates, `from` included.
 *
 * What a cash-flow projection walks: a monthly charge contributes once to the
 * end of the month and a weekly one four times, and getting that wrong is the
 * difference between a projection and a guess.
 */
export function nextOccurrences(
  recurrence: Pick<Recurrence, "cadence" | "nextDate">,
  from: string,
  to: string,
): string[] {
  const spec = specOf(recurrence.cadence);
  const dates: string[] = [];
  let cursor = recurrence.nextDate;
  // A weekly charge over a year is 52 steps; the cap is only a guard against
  // a malformed range spinning forever.
  for (let i = 0; i < 500 && cursor <= to; i++) {
    if (cursor >= from) dates.push(cursor);
    cursor = step(cursor, spec);
  }
  return dates;
}

/** Weeks per month, averaged over a year. The same 52/12 a weekly budget uses. */
const WEEKS_PER_MONTH = 52 / 12;

/**
 * What this costs a month, whatever its cadence.
 *
 * The only figure that lets a weekly gym, a monthly subscription and a yearly
 * insurance premium be added up or ranked against each other.
 */
export function monthlyCostCents(recurrence: Pick<Recurrence, "cadence" | "medianAmountCents">): number {
  const amount = recurrence.medianAmountCents;
  switch (recurrence.cadence) {
    case "weekly":
      return Math.round(amount * WEEKS_PER_MONTH);
    case "monthly":
      return amount;
    case "quarterly":
      return Math.round(amount / 3);
    case "yearly":
      return Math.round(amount / 12);
  }
}

/**
 * How far the amount is allowed to wander before the charge is called unusual.
 *
 * A frais fixe flags anything outside its tolerance, so one figure cannot
 * serve both a subscription billed to the centime and an energy bill that
 * doubles in January. Ten percent on EDF means a red badge most of the year,
 * and a badge that is always on is one nobody reads.
 *
 * Taken from what the charge has actually done: the second-widest deviation
 * from the typical amount, so a single catch-up bill does not set the
 * tolerance for everything after it. Rounded up to five, and never outside
 * 5-50: below that any bill looks unusual, above it nothing ever does.
 */
export function suggestedTolerancePct(
  occurrences: readonly Occurrence[],
  medianAmountCents: number,
): number {
  if (occurrences.length < 2 || medianAmountCents === 0) return 10;
  const deviations = occurrences
    .map((o) => Math.abs(Math.abs(o.amountCents) - medianAmountCents))
    .sort((a, b) => b - a);
  const widest = deviations[Math.min(1, deviations.length - 1)];
  const pct = (widest / medianAmountCents) * 100;
  return Math.min(50, Math.max(5, Math.ceil(pct / 5) * 5));
}

/**
 * A pattern that would match this charge, for the frais fixe it is offered as.
 *
 * The key is built by dropping words, so its tokens are not always next to
 * each other in the label it came from. A pattern that matches nothing would
 * create a charge permanently reported as unpaid, so it is checked against the
 * labels actually seen and falls back to the first word when the whole key
 * does not hold.
 */
export function suggestPattern(key: string, labels: readonly string[]): string {
  const whole = key.toUpperCase();
  if (labels.length > 0 && labels.every((l) => l.includes(whole))) return whole;
  return whole.split(" ")[0];
}

export type AmountDrift = {
  fromCents: number;
  toCents: number;
  changePct: number;
  /** The first charge at the new level, so the rise can be dated. */
  since: string;
};

/** Below this, a change is the bill breathing rather than a price rise. */
const DRIFT_MIN_PCT = 5;
const DRIFT_MIN_CENTS = 100;

/**
 * What the charge costs now against what it used to, in absolute values.
 *
 * Medians of the recent charges against the ones before them, never the last
 * against the first: a single estimated meter reading would otherwise be
 * reported as a permanent rise. Null means the amount has held, or that there
 * is not enough history to say.
 */
export function amountDrift(
  occurrences: readonly Occurrence[],
  minPct: number = DRIFT_MIN_PCT,
): AmountDrift | null {
  if (occurrences.length < 4) return null;
  const sorted = [...occurrences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const window = Math.min(3, Math.floor(sorted.length / 2));
  const recent = sorted.slice(-window);
  const previous = sorted.slice(-2 * window, -window);

  const toCents = median(recent.map((o) => Math.abs(o.amountCents)));
  const fromCents = median(previous.map((o) => Math.abs(o.amountCents)));
  if (fromCents === 0) return null;

  const changePct = ((toCents - fromCents) / fromCents) * 100;
  if (Math.abs(changePct) < minPct || Math.abs(toCents - fromCents) < DRIFT_MIN_CENTS) return null;

  return { fromCents, toCents, changePct, since: recent[0].date };
}

export type YearOnYear = {
  recentCents: number;
  previousCents: number;
  changePct: number;
};

/**
 * Twelve months against the twelve before them.
 *
 * The honest way to compare a bill with itself. Last month against the same
 * month last year reads as a rise whenever a quarterly bill happens to land in
 * one and not the other, and a monthly charge taken twice in March would say
 * the rent doubled. A rolling year contains exactly one of everything.
 *
 * Takes the series newest-last, one bucket per month, zeros included. Null when
 * there is not a full two years to compare, or when the earlier year is empty:
 * a charge that started this year has not risen, it has begun.
 */
export function yearOnYear(series: readonly { month: string; cents: number }[]): YearOnYear | null {
  if (series.length < 24) return null;
  const sum = (rows: readonly { cents: number }[]) => rows.reduce((a, r) => a + Math.abs(r.cents), 0);
  const recentCents = sum(series.slice(-12));
  const previousCents = sum(series.slice(-24, -12));
  if (previousCents === 0) return null;
  return {
    recentCents,
    previousCents,
    changePct: ((recentCents - previousCents) / previousCents) * 100,
  };
}
