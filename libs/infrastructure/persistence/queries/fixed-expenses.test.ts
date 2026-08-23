import { describe, it, expect } from "vitest";
import {
  summarizeFixedExpenses,
  summarizeTrends,
  type FixedExpenseStatus,
  type FixedExpenseTrend,
} from "./fixed-expenses";
import type { ExpenseCadence } from "@domain/enums";

function trend(
  name: string,
  yoy: { recentCents: number; previousCents: number } | null,
): FixedExpenseTrend {
  return {
    fixedExpense: { name } as FixedExpenseTrend["fixedExpense"],
    category: null,
    series: [],
    yearOnYear: yoy
      ? {
          ...yoy,
          changePct: ((yoy.recentCents - yoy.previousCents) / yoy.previousCents) * 100,
        }
      : null,
    drift: null,
    lastYearCents: yoy?.recentCents ?? 0,
    monthlyCents: 0,
    occurrences: 0,
  };
}

describe("what the fixed charges did over the year", () => {
  it("totals both years and names the steepest rise in euros", () => {
    const summary = summarizeTrends([
      trend("Loyer", { previousCents: 900_000, recentCents: 927_000 }),
      trend("EDF", { previousCents: 120_000, recentCents: 158_000 }),
    ]);
    expect(summary.recentCents).toBe(1_085_000);
    expect(summary.comparison?.previousCents).toBe(1_020_000);
    expect(summary.comparison?.changePct).toBeCloseTo(6.37, 1);
    // The rent rose more in percent terms than nothing, but EDF cost more.
    expect(summary.steepest?.name).toBe("EDF");
    expect(summary.steepest?.changeCents).toBe(38_000);
  });

  it("keeps a charge with no year to compare out of the comparison, not the total", () => {
    // A subscription taken out in March is a new charge, not a rise: counting
    // it in the comparison would report bills going up when what happened is a
    // purchase. What it cost this year is still perfectly knowable.
    const newOne = trend("Nouveau streaming", null);
    newOne.lastYearCents = 12_000;
    const summary = summarizeTrends([
      trend("Loyer", { previousCents: 900_000, recentCents: 900_000 }),
      newOne,
    ]);
    expect(summary.recentCents).toBe(912_000);
    expect(summary.comparison).toMatchObject({ recentCents: 900_000, changePct: 0, charges: 1 });
  });

  it("says nothing rather than dividing by an empty year", () => {
    const summary = summarizeTrends([]);
    expect(summary.comparison).toBeNull();
    expect(summary.steepest).toBeNull();
  });

  it("names no steepest rise when everything fell", () => {
    const summary = summarizeTrends([trend("EDF", { previousCents: 150_000, recentCents: 120_000 })]);
    expect(summary.comparison?.changePct).toBeCloseTo(-20, 5);
    expect(summary.steepest).toBeNull();
  });
});


function status(
  name: string,
  cadence: ExpenseCadence,
  expectedAmountCents: number,
  over: Partial<FixedExpenseStatus> = {},
): FixedExpenseStatus {
  return {
    fixedExpense: { name, cadence, expectedAmountCents, isActive: true } as FixedExpenseStatus["fixedExpense"],
    category: null,
    matched: [],
    paidAmountCents: 0,
    state: "pending",
    variancePct: null,
    period: { start: "2026-08-01", end: "2026-08-31", dueDate: "2026-08-15" },
    nextDueDate: "2026-09-15",
    dueThisMonth: true,
    ...over,
  };
}

describe("the month's picture, with charges of every cadence", () => {
  it("counts what this month owes, not what every charge costs", () => {
    // The water was taken in August and is not September's business; putting
    // it in September's "reste à payer" reports money leaving that is not
    // going anywhere for another two months.
    const summary = summarizeFixedExpenses([
      status("Loyer", "monthly", 90_000),
      status("Eau", "quarterly", 5_100, { dueThisMonth: false, state: "paid" }),
    ]);
    expect(summary.total).toBe(1);
    expect(summary.expectedTotalCents).toBe(90_000);
  });

  it("keeps a late charge in view even once its period has moved on", () => {
    const summary = summarizeFixedExpenses([
      status("Ordures", "yearly", 15_000, { dueThisMonth: false, state: "overdue" }),
    ]);
    expect(summary.total).toBe(1);
    expect(summary.overdue).toBe(1);
  });

  it("shares every cadence out per month for the commitment figure", () => {
    // 900 a month, 51 a quarter and 150 a year is 900 + 17 + 12,50.
    const summary = summarizeFixedExpenses([
      status("Loyer", "monthly", 90_000),
      status("Eau", "quarterly", 5_100, { dueThisMonth: false }),
      status("Ordures", "yearly", 15_000, { dueThisMonth: false }),
    ]);
    expect(summary.monthlyCommitmentCents).toBe(90_000 + 1_700 + 1_250);
    expect(summary.otherCadences).toBe(2);
  });

  it("leaves a paused charge out of both figures", () => {
    const paused = status("Ancienne assurance", "yearly", 20_000);
    paused.fixedExpense = { ...paused.fixedExpense, isActive: false };
    const summary = summarizeFixedExpenses([paused]);
    expect(summary.total).toBe(0);
    expect(summary.monthlyCommitmentCents).toBe(0);
  });
});
