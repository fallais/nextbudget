import "server-only";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  formatISO,
  getDaysInMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { TransactionEntity } from "@infrastructure/persistence/schemas";
import { nextOccurrences } from "@domain/services/recurrence";
import { projectBalance, type Projection, type ScheduledFlow } from "@domain/services/projection";
import { titleCase } from "@shared/format";
import { visibleAccountIds, applyAccountScope } from "./scope";
import { excludeTransfers } from "./transfers";
import { compiledFixedExpenseRules, getFixedExpensesWithStatus } from "./fixed-expenses";
import { listRecurringIncome } from "./recurring";
import { getAccountBalances } from "./queries";
import { getScope } from "@application/scope";

/**
 * Where the balance is heading, from what the app already knows.
 *
 * Two halves, and the line between them is what keeps the figure honest.
 * Anything identifiable on a statement is scheduled on the day it happens: a
 * frais fixe has a pattern and a due day, a salary repeats and its cadence was
 * worked out from the ledger. Everything else is a daily average, because the
 * date of the big shop is not knowable and inventing one would be false
 * precision.
 *
 * Nothing is counted twice, which is the trap this kind of figure usually
 * falls into: the everyday average is taken over spending that no declared
 * charge matches, so the rent is in the projection once, on the 5th, and not
 * also smeared across thirty days.
 */

export type CashflowProjection =
  | {
      available: false;
      /** No account has an opening balance, so there is no balance to project. */
      reason: "no_balance";
      unanchoredAccounts: number;
    }
  | ({
      available: true;
      from: string;
      to: string;
      startingBalanceCents: number;
      /** Charges expected but never seen arriving, and the salary that pays them. */
      incomeKnown: boolean;
      /** Accounts left out for want of an opening balance. */
      unanchoredAccounts: number;
    } & Projection);

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** Below this many days left, the month ahead is more useful than this one. */
const SHORT_MONTH_TAIL = 10;

/** Average days in a month, for turning a monthly figure into a daily one. */
const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Everyday spending per day: whatever no declared charge accounts for.
 *
 * The median of the last three complete months rather than their mean. A car
 * bought in June is not a monthly habit, and an average that includes it would
 * project the household into the red every month for a quarter.
 */
async function dailyDiscretionaryCents(now: Date): Promise<number> {
  const ds = await getDataSource();
  const from = startOfMonth(subMonths(now, 3));
  const to = endOfMonth(subMonths(now, 1));

  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :from", { from: isoDate(from) })
    .andWhere("t.date <= :to", { to: isoDate(to) })
    .andWhere("t.amount_cents < 0");
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  // A transfer to your own savings is not spending, and a declared charge is
  // already in the projection by name.
  excludeTransfers(qb, "t");
  const rows = await qb.getMany();
  if (rows.length === 0) return 0;

  const declared = await compiledFixedExpenseRules();
  const byMonth = new Map<string, number>();
  for (const t of rows) {
    if (declared.some((rule) => rule.test(t.normalizedDescription, t.amountCents))) continue;
    const month = t.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + Math.abs(t.amountCents));
  }

  const months = [format(subMonths(now, 3), "yyyy-MM"), format(subMonths(now, 2), "yyyy-MM"), format(subMonths(now, 1), "yyyy-MM")];
  const totals = months.map((m) => byMonth.get(m) ?? 0).sort((a, b) => a - b);
  const median = totals[Math.floor((totals.length - 1) / 2)];
  return Math.round(median / DAYS_PER_MONTH);
}

/**
 * Every instalment of one charge inside the window.
 *
 * The month already settled is skipped, and one still owed with its due day
 * behind it is kept: money about to leave is not money saved. A charge with no
 * due day is put mid-month, which is the least wrong place for something the
 * statement has never told us the date of.
 */
function fixedExpenseFlows(
  name: string,
  expectedAmountCents: number,
  dueDay: number | null,
  paidThisMonth: boolean,
  from: string,
  to: string,
  now: Date,
): ScheduledFlow[] {
  const flows: ScheduledFlow[] = [];
  for (let i = 0; i < 3; i++) {
    const month = addMonths(startOfMonth(now), i);
    if (i === 0 && paidThisMonth) continue;
    const day = Math.min(dueDay ?? 15, getDaysInMonth(month));
    const date = format(new Date(month.getFullYear(), month.getMonth(), day), "yyyy-MM-dd");
    if (date > to) break;
    // Before the window only happens for this month's charge, still unpaid.
    flows.push({ label: name, amountCents: -expectedAmountCents, date: date < from ? from : date });
  }
  return flows;
}

export async function getCashflowProjection(now: Date = new Date()): Promise<CashflowProjection> {
  const balances = await getAccountBalances();
  const anchored = balances.filter((b) => b.balanceCents !== null);
  const unanchoredAccounts = balances.length - anchored.length;
  if (anchored.length === 0) {
    return { available: false, reason: "no_balance", unanchoredAccounts };
  }

  const from = isoDate(now);
  // A projection with four days left in it answers nothing; when the month is
  // nearly out, the question has already become next month's.
  const thisMonthEnd = endOfMonth(now);
  const to = isoDate(
    differenceInCalendarDays(thisMonthEnd, now) < SHORT_MONTH_TAIL
      ? endOfMonth(addMonths(now, 1))
      : thisMonthEnd,
  );

  const [statuses, income, daily] = await Promise.all([
    getFixedExpensesWithStatus(now),
    listRecurringIncome(),
    dailyDiscretionaryCents(now),
  ]);

  const flows: ScheduledFlow[] = [];
  for (const status of statuses) {
    const fx = status.fixedExpense;
    if (!fx.isActive) continue;
    flows.push(
      ...fixedExpenseFlows(
        fx.name,
        fx.expectedAmountCents,
        fx.dueDay,
        status.state === "paid" || status.state === "anomaly",
        from,
        to,
        now,
      ),
    );
  }

  for (const candidate of income) {
    for (const date of nextOccurrences(candidate.recurrence, from, to)) {
      flows.push({
        label: titleCase(candidate.key),
        amountCents: candidate.recurrence.medianAmountCents,
        date,
      });
    }
  }

  const startingBalanceCents = anchored.reduce((a, b) => a + (b.balanceCents ?? 0), 0);
  return {
    available: true,
    from,
    to,
    startingBalanceCents,
    incomeKnown: income.length > 0,
    unanchoredAccounts,
    ...projectBalance({ from, to, startingBalanceCents, flows, dailyDiscretionaryCents: daily }),
  };
}
