import { describe, it, expect } from "vitest";
import {
  isPeriodKey,
  periodToRange,
  previousPeriodRange,
  PERIOD_OPTIONS,
  type PeriodKey,
} from "./period";

/**
 * Mid-month, mid-year, and a month with 31 days, so an off-by-one at either
 * end of a range shows up rather than landing on a boundary that hides it.
 */
const NOW = new Date(2026, 4, 15, 13, 30); // 15 May 2026, local

describe("periodToRange", () => {
  it("bounds the current month at both ends", () => {
    expect(periodToRange("month", NOW)).toEqual({ from: "2026-05-01", to: "2026-05-31" });
  });

  it("counts three months inclusive of this one, not three before it", () => {
    // March, April, May. A window starting in February would quietly compare
    // four months of spending against three.
    expect(periodToRange("3m", NOW)).toEqual({ from: "2026-03-01", to: "2026-05-31" });
  });

  it("bounds the calendar year", () => {
    expect(periodToRange("year", NOW)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("puts no bound on everything", () => {
    expect(periodToRange("all", NOW)).toEqual({ from: null, to: null });
  });

  it("reaches the last day of a short month", () => {
    expect(periodToRange("month", new Date(2026, 1, 10)).to).toBe("2026-02-28");
    // 2028 is a leap year: the 29th has to be inside the range.
    expect(periodToRange("month", new Date(2028, 1, 10)).to).toBe("2028-02-29");
  });

  it("does not drift a day when the clock is near midnight", () => {
    // formatISO on a local Date must give the local day, not the UTC one.
    expect(periodToRange("month", new Date(2026, 4, 15, 23, 59)).from).toBe("2026-05-01");
    expect(periodToRange("month", new Date(2026, 4, 15, 0, 1)).to).toBe("2026-05-31");
  });
});

describe("previousPeriodRange", () => {
  it("is the month before, whole", () => {
    expect(previousPeriodRange("month", NOW)).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("is the three months before those three, and does not overlap them", () => {
    const current = periodToRange("3m", NOW);
    const previous = previousPeriodRange("3m", NOW);
    expect(previous).toEqual({ from: "2025-12-01", to: "2026-02-28" });
    // The comparison is only meaningful if the two windows are disjoint.
    expect(previous.to! < current.from!).toBe(true);
  });

  it("is the year before, whole", () => {
    expect(previousPeriodRange("year", NOW)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("has nothing to compare « tout » against", () => {
    expect(previousPeriodRange("all", NOW)).toEqual({ from: null, to: null });
  });

  it("steps back across a year boundary", () => {
    expect(previousPeriodRange("month", new Date(2026, 0, 10))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("covers the same number of months as the period it precedes", () => {
    // A variation percentage compares two windows; unequal lengths make it a
    // lie regardless of the arithmetic.
    for (const period of ["month", "3m", "year"] as const) {
      const cur = periodToRange(period, NOW);
      const prev = previousPeriodRange(period, NOW);
      const months = (r: { from: string | null; to: string | null }) => {
        const [fy, fm] = r.from!.split("-").map(Number);
        const [ty, tm] = r.to!.split("-").map(Number);
        return (ty - fy) * 12 + (tm - fm) + 1;
      };
      expect(months(prev)).toBe(months(cur));
    }
  });
});

describe("isPeriodKey", () => {
  it("accepts every option the UI offers", () => {
    for (const p of PERIOD_OPTIONS) expect(isPeriodKey(p)).toBe(true);
  });

  it("rejects anything else, including what a URL might carry", () => {
    // It guards a query string, so the inputs are whatever someone typed.
    for (const v of ["", "MONTH", "week", "3M", null, undefined, 3, {}, ["month"]]) {
      expect(isPeriodKey(v)).toBe(false);
    }
  });

  it("narrows the type for the caller", () => {
    const raw: unknown = "3m";
    if (isPeriodKey(raw)) {
      const key: PeriodKey = raw;
      expect(key).toBe("3m");
    }
  });
});
