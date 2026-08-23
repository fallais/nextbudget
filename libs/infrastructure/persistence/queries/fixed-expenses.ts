import "server-only";
/**
 * Fixed-expense read models: which bills this month have been paid and which
 * are still outstanding, matched against what actually landed. The writes are
 * `@application/fixed-expenses`.
 */
import { addDays, startOfMonth, endOfMonth, subMonths, format, formatISO, parseISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { FixedExpenseEntity, CategoryEntity, TransactionEntity } from "@infrastructure/persistence/schemas";
import type { FixedExpenseRow, CategoryRow, TransactionRow } from "@domain/entities";
import { compileRule } from "@domain/services/categorization";
import {
  currentPeriod,
  monthlyShareCents,
  nextDueDate as nextDue,
  OVERDUE_GRACE_DAYS,
  type Period,
} from "@domain/services/cadence";
import {
  amountDrift,
  yearOnYear,
  type AmountDrift,
  type YearOnYear,
} from "@domain/services/recurrence";
import { visibleAccountIds, applyAccountScope, applyOwnedScope } from "./scope";
import { getScope } from "@application/scope";

export type FixedExpenseStatus = {
  fixedExpense: FixedExpenseRow;
  category: CategoryRow | null;
  /** The charges that answered for it, inside its own period. */
  matched: Pick<TransactionRow, "id" | "date" | "description" | "amountCents">[];
  paidAmountCents: number;
  state: "paid" | "pending" | "overdue" | "anomaly";
  variancePct: number | null;
  /** The window this verdict is about: a month, a quarter, a year, a week. */
  period: Period;
  /**
   * When it is next expected, after today. What a list row shows for a charge
   * that is not monthly, where "le 15" leaves out the eleven months that matter.
   */
  nextDueDate: string | null;
  /**
   * Whether this month is when it falls due.
   *
   * A quarterly bill taken in August is not a September problem, and counting
   * it in September's "reste à payer" would report money leaving that is not
   * going anywhere for another two months.
   */
  dueThisMonth: boolean;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

type MatchableTransaction = {
  id: number;
  date: string;
  description: string;
  normalized: string;
  amountCents: number;
};

/** The charge as the scheduling maths wants it. */
export function scheduleOf(fx: FixedExpenseRow) {
  return { cadence: fx.cadence, dueDay: fx.dueDay, dueMonth: fx.dueMonth };
}

/**
 * One charge, judged inside its own period.
 *
 * Its own, not the calendar month, which is the whole point of cadences: the
 * taxe d'ordures ménagères asked "was it paid this month" answers no eleven
 * times a year, and a page that cries wolf eleven months out of twelve is a
 * page nobody opens in the twelfth.
 *
 * The ledger handed in has to reach back to the start of the earliest period on
 * the list, which for a yearly charge is up to twelve months. The caller works
 * that out once for the whole list rather than querying per charge.
 */
function statusOf(
  fx: FixedExpenseRow,
  category: CategoryRow | null,
  ledger: MatchableTransaction[],
  today: string,
): FixedExpenseStatus {
  const period = currentPeriod(scheduleOf(fx), today);
  const idle: FixedExpenseStatus = {
    fixedExpense: fx,
    category,
    matched: [],
    paidAmountCents: 0,
    state: "pending",
    variancePct: null,
    period,
    nextDueDate: nextDue(scheduleOf(fx), today),
    dueThisMonth: isThisMonth(period.dueDate, today) || period.dueDate === null,
  };
  if (!fx.isActive) return idle;

  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: fx.matchPattern,
    matchType: fx.matchType,
    amountCondition: "negative",
    priority: 0,
  });
  if (!compiled) return idle;

  const matched = ledger
    .filter((t) => t.date >= period.start && t.date <= period.end)
    .filter((t) => compiled.test(t.normalized, t.amountCents))
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amountCents: t.amountCents,
    }));
  const paid = matched.reduce((a, t) => a + Math.abs(t.amountCents), 0);
  const expected = fx.expectedAmountCents;
  const variance = paid === 0 ? null : (paid - expected) / expected;

  let state: FixedExpenseStatus["state"];
  if (matched.length === 0) {
    // Late only once the stated day has gone by with a margin. A charge that
    // never said which day is awaited to the end of its period, never late.
    state = period.dueDate !== null && today > addGrace(period.dueDate) ? "overdue" : "pending";
  } else if (variance !== null && Math.abs(variance) * 100 > fx.tolerancePct) {
    state = "anomaly";
  } else {
    state = "paid";
  }

  return {
    fixedExpense: fx,
    category,
    matched,
    paidAmountCents: paid,
    state,
    variancePct: variance === null ? null : variance * 100,
    period,
    nextDueDate: nextDue(scheduleOf(fx), today),
    dueThisMonth: isThisMonth(period.dueDate, today) || period.dueDate === null,
  };
}

function addGrace(dueDate: string): string {
  return isoDate(addDays(parseISO(dueDate), OVERDUE_GRACE_DAYS));
}

function isThisMonth(date: string | null, today: string): boolean {
  return date !== null && date.slice(0, 7) === today.slice(0, 7);
}

/**
 * The transactions the periods on this page can possibly be answered by.
 *
 * Bounded by the earliest period start rather than by a fixed year: an install
 * with nothing but monthly charges reads one month, exactly as it always did,
 * and only a yearly charge makes it reach back twelve.
 */
async function ledgerSince(from: string, now: Date): Promise<MatchableTransaction[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :start", { start: from })
    .andWhere("t.date <= :end", { end: isoDate(endOfMonth(now)) });
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  return (await qb.getMany()).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    normalized: t.normalizedDescription,
    amountCents: t.amountCents,
  }));
}

function earliestStart(rows: FixedExpenseRow[], today: string): string {
  return rows
    .map((fx) => currentPeriod(scheduleOf(fx), today).start)
    .reduce((a, b) => (a < b ? a : b), today);
}

/** One charge with its status — `null` when it does not exist or is out of scope. */
export async function getFixedExpenseStatus(
  id: number,
  now: Date = new Date(),
): Promise<FixedExpenseStatus | null> {
  const ds = await getDataSource();
  const qb = ds.getRepository(FixedExpenseEntity).createQueryBuilder("f").where("f.id = :id", { id });
  applyOwnedScope(qb, "f", await getScope());
  const fx = await qb.getOne();
  if (!fx) return null;

  const category =
    fx.categoryId != null
      ? await ds.getRepository(CategoryEntity).findOne({ where: { id: fx.categoryId } })
      : null;

  const today = isoDate(now);
  return statusOf(fx, category, await ledgerSince(earliestStart([fx], today), now), today);
}

export type FixedExpenseMonth = {
  month: string;
  paidCents: number;
  count: number;
};

/**
 * What this charge actually cost, month by month.
 *
 * A fixed expense is only fixed until it is not — an index-linked rent, a
 * yearly insurance rise, a forgotten direct debit. Twelve months of it says
 * more than one month against a figure you typed in once.
 */
export async function getFixedExpenseHistory(
  id: number,
  months = 12,
  now: Date = new Date(),
): Promise<FixedExpenseMonth[]> {
  const ds = await getDataSource();
  const qb = ds.getRepository(FixedExpenseEntity).createQueryBuilder("f").where("f.id = :id", { id });
  applyOwnedScope(qb, "f", await getScope());
  const fx = await qb.getOne();
  if (!fx) return [];

  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: fx.matchPattern,
    matchType: fx.matchType,
    amountCondition: "negative",
    priority: 0,
  });
  if (!compiled) return [];

  const from = startOfMonth(subMonths(now, months - 1));
  const txQb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :from", { from: isoDate(from) })
    .andWhere("t.date <= :to", { to: isoDate(endOfMonth(now)) });
  applyAccountScope(txQb, "t", await visibleAccountIds(await getScope()));

  const buckets = new Map<string, { paidCents: number; count: number }>();
  for (const t of await txQb.getMany()) {
    if (!compiled.test(t.normalizedDescription, t.amountCents)) continue;
    const key = t.date.slice(0, 7);
    const bucket = buckets.get(key) ?? { paidCents: 0, count: 0 };
    bucket.paidCents += Math.abs(t.amountCents);
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  // Months with nothing are zeros, not gaps: a missed direct debit is the
  // whole point of looking.
  return Array.from({ length: months }, (_, i) => {
    const month = format(startOfMonth(subMonths(now, months - 1 - i)), "yyyy-MM");
    const bucket = buckets.get(month);
    return { month, paidCents: bucket?.paidCents ?? 0, count: bucket?.count ?? 0 };
  });
}

export async function getFixedExpensesWithStatus(
  now: Date = new Date(),
): Promise<FixedExpenseStatus[]> {
  const ds = await getDataSource();
  const fxQb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(fxQb, "f", await getScope());
  const fxList = await fxQb.getMany();
  if (fxList.length === 0) return [];

  const cats = await ds.getRepository(CategoryEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));

  // One read for the whole list, matched in memory: the patterns are regexes
  // and `contains` on a normalised label, which Postgres cannot index anyway.
  const today = isoDate(now);
  const ledger = await ledgerSince(earliestStart(fxList, today), now);
  return fxList.map((fx) =>
    statusOf(fx, fx.categoryId != null ? (catMap.get(fx.categoryId) ?? null) : null, ledger, today),
  );
}

export type FixedExpensesSummary = {
  /** Charges this month has to answer for: due now, or late from before. */
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  anomaly: number;
  expectedTotalCents: number;
  paidTotalCents: number;
  /**
   * What every active charge commits per month, cadences shared out.
   *
   * A different question from the one above, and the two only agreed while
   * everything was monthly: a 150 euro premium taken every April is 12,50 a
   * month of commitment and 150 euros of April.
   */
  monthlyCommitmentCents: number;
  /** Active charges that are not monthly, so the page can say so. */
  otherCadences: number;
};

/**
 * The month's picture.
 *
 * Only charges this month actually has to answer for are counted: one due now,
 * or one late from an earlier period, which still has to be paid. A quarterly
 * bill settled in August is not September's business, and putting it in
 * September's "reste à payer" would report money leaving that is not going
 * anywhere for another two months.
 */
export function summarizeFixedExpenses(
  statuses: FixedExpenseStatus[],
): FixedExpensesSummary {
  const summary: FixedExpensesSummary = {
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    anomaly: 0,
    expectedTotalCents: 0,
    paidTotalCents: 0,
    monthlyCommitmentCents: 0,
    otherCadences: 0,
  };
  for (const s of statuses) {
    const fx = s.fixedExpense;
    if (!fx.isActive) continue;
    summary.monthlyCommitmentCents += monthlyShareCents(fx.expectedAmountCents, fx.cadence);
    if (fx.cadence !== "monthly") summary.otherCadences++;
    if (!s.dueThisMonth && s.state !== "overdue") continue;
    summary.total++;
    summary[s.state]++;
    summary.expectedTotalCents += fx.expectedAmountCents;
    summary.paidTotalCents += s.paidAmountCents;
  }
  return summary;
}

/**
 * Fixed expenses visible to the current scope, in the order the UI shows them:
 * by due day, then name. A no-op filter in open mode.
 */
export async function listFixedExpenses(): Promise<FixedExpenseRow[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(qb, "f", await getScope());
  return qb.getMany();
}

/**
 * The active charges as matchers, for the two places that need to recognise a
 * declared charge on the statement.
 *
 * A projection schedules them by name and must keep them out of its everyday
 * average, and the suggestions list must not offer one that is already
 * tracked. Both are the same question, and answering it twice in two files is
 * how they come to disagree.
 */
export async function compiledFixedExpenseRules() {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .where("f.is_active = true");
  applyOwnedScope(qb, "f", await getScope());
  return (await qb.getMany())
    .map((f) =>
      compileRule({
        id: f.id,
        categoryId: 0,
        pattern: f.matchPattern,
        matchType: f.matchType,
        amountCondition: "negative",
        priority: 0,
      }),
    )
    .filter((rule) => rule !== null);
}

export type FixedExpenseTrend = {
  fixedExpense: FixedExpenseRow;
  category: CategoryRow | null;
  /** Monthly buckets, oldest first, zeros included. */
  series: FixedExpenseMonth[];
  /** A rolling year against the one before. Null until two years are on file. */
  yearOnYear: YearOnYear | null;
  /** What one charge costs now against what it cost, occurrence to occurrence. */
  drift: AmountDrift | null;
  /** What it took over the last twelve months. Known even when the year before is not. */
  lastYearCents: number;
  /** The same figure over twelve, whatever the cadence. */
  monthlyCents: number;
  /** How many times it was actually taken over the window. */
  occurrences: number;
};

/** Two years, because a year on its own has nothing to be compared against. */
const TREND_MONTHS = 24;

/**
 * What each charge has done to you over two years.
 *
 * A frais fixe is a figure you typed in once, and the interesting question is
 * never whether this month matched it: it is that the water was 42 euros a
 * quarter when you wrote it down and is 51 now. Both halves of that are here,
 * and they answer different questions.
 *
 * `yearOnYear` compares a rolling year with the year before it, which is the
 * only honest comparison for a bill: last month against the same month last
 * year calls a quarterly charge a 100% rise whenever it lands in one month and
 * not the other, and a monthly charge taken twice in March would report the
 * rent doubling. `drift` compares the charges themselves, which is what
 * catches a subscription that stepped up in April and has stayed there.
 *
 * One query for the whole list, matched in memory: the patterns are regexes
 * and `contains` on a normalised label, which Postgres cannot index anyway.
 */
export async function getFixedExpenseTrends(
  months = TREND_MONTHS,
  now: Date = new Date(),
): Promise<FixedExpenseTrend[]> {
  const ds = await getDataSource();
  const fxQb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .where("f.is_active = true")
    .orderBy("f.name", "ASC");
  applyOwnedScope(fxQb, "f", await getScope());
  const fxList = await fxQb.getMany();
  if (fxList.length === 0) return [];

  const cats = await ds.getRepository(CategoryEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const from = startOfMonth(subMonths(now, months - 1));
  const txQb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :from", { from: isoDate(from) })
    .andWhere("t.date <= :to", { to: isoDate(endOfMonth(now)) });
  applyAccountScope(txQb, "t", await visibleAccountIds(await getScope()));
  const ledger = await txQb.getMany();

  const buckets = Array.from({ length: months }, (_, i) =>
    format(startOfMonth(subMonths(now, months - 1 - i)), "yyyy-MM"),
  );

  return fxList.map((fx) => {
    const compiled = compileRule({
      id: 0,
      categoryId: 0,
      pattern: fx.matchPattern,
      matchType: fx.matchType,
      amountCondition: "negative",
      priority: 0,
    });
    const matched = compiled
      ? ledger.filter((t) => compiled.test(t.normalizedDescription, t.amountCents))
      : [];

    const byMonth = new Map<string, { paidCents: number; count: number }>();
    for (const t of matched) {
      const key = t.date.slice(0, 7);
      const bucket = byMonth.get(key) ?? { paidCents: 0, count: 0 };
      bucket.paidCents += Math.abs(t.amountCents);
      bucket.count += 1;
      byMonth.set(key, bucket);
    }
    const series: FixedExpenseMonth[] = buckets.map((month) => ({
      month,
      paidCents: byMonth.get(month)?.paidCents ?? 0,
      count: byMonth.get(month)?.count ?? 0,
    }));

    const lastYearCents = series.slice(-12).reduce((a, m) => a + m.paidCents, 0);
    return {
      fixedExpense: fx,
      category: fx.categoryId != null ? (catMap.get(fx.categoryId) ?? null) : null,
      series,
      yearOnYear: yearOnYear(series.map((m) => ({ month: m.month, cents: m.paidCents }))),
      drift: amountDrift(matched.map((t) => ({ date: t.date, amountCents: t.amountCents }))),
      lastYearCents,
      monthlyCents: Math.round(lastYearCents / 12),
      occurrences: matched.length,
    };
  });
}

export type FixedExpensesTrendSummary = {
  /** Everything these charges took over the last twelve months. Always known. */
  recentCents: number;
  /**
   * The year-on-year figure, over the charges that have two full years behind
   * them. Null when none has, which is most of the first two years.
   */
  comparison: {
    recentCents: number;
    previousCents: number;
    changePct: number;
    /** How many charges the comparison covers, of the ones listed. */
    charges: number;
  } | null;
  /** The charge that rose most in euros, which is rarely the one that rose most in percent. */
  steepest: { name: string; changeCents: number; changePct: number } | null;
};

/**
 * The household total, and the one line responsible for most of it.
 *
 * The total is over everything: what these charges took in a year is knowable
 * from a year of statements. The comparison is not, and is kept separate for
 * that reason: it counts only charges with a full year on each side, or a
 * subscription taken out in March would arrive as a rise in the household
 * total when it is a new charge, and the figure would say the bills went up
 * when what happened is that something was bought.
 */
export function summarizeTrends(trends: FixedExpenseTrend[]): FixedExpensesTrendSummary {
  const comparable = trends.filter((t) => t.yearOnYear !== null);
  const previousCents = comparable.reduce((a, t) => a + t.yearOnYear!.previousCents, 0);
  const comparableRecent = comparable.reduce((a, t) => a + t.yearOnYear!.recentCents, 0);

  let steepest: FixedExpensesTrendSummary["steepest"] = null;
  for (const t of comparable) {
    const changeCents = t.yearOnYear!.recentCents - t.yearOnYear!.previousCents;
    if (changeCents > 0 && (steepest === null || changeCents > steepest.changeCents)) {
      steepest = {
        name: t.fixedExpense.name,
        changeCents,
        changePct: t.yearOnYear!.changePct,
      };
    }
  }

  return {
    recentCents: trends.reduce((a, t) => a + t.lastYearCents, 0),
    comparison:
      previousCents === 0
        ? null
        : {
            recentCents: comparableRecent,
            previousCents,
            changePct: ((comparableRecent - previousCents) / previousCents) * 100,
            charges: comparable.length,
          },
    steepest,
  };
}
