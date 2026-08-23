import { describe, it, expect } from "vitest";
import { summarizeTrends, type FixedExpenseTrend } from "./fixed-expenses";

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
