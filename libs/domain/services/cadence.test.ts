import { describe, it, expect } from "vitest";
import {
  currentPeriod,
  monthlyShareCents,
  nextDueDate,
  yearlyShareCents,
  type Schedule,
} from "./cadence";

const monthly = (dueDay: number | null): Schedule => ({
  cadence: "monthly",
  dueDay,
  dueMonth: null,
});
const quarterly = (dueDay: number, dueMonth: number): Schedule => ({
  cadence: "quarterly",
  dueDay,
  dueMonth,
});
const yearly = (dueDay: number, dueMonth: number): Schedule => ({
  cadence: "yearly",
  dueDay,
  dueMonth,
});

describe("the window a charge is judged in", () => {
  it("is the month, for a monthly charge", () => {
    expect(currentPeriod(monthly(5), "2026-08-23")).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
      dueDate: "2026-08-05",
    });
  });

  it("is the quarter it was anchored in, not the calendar quarter", () => {
    // A water bill taken in February, May, August and November. Judged by
    // calendar quarters it would look unpaid every January.
    const period = currentPeriod(quarterly(15, 2), "2026-08-23");
    expect(period).toEqual({ start: "2026-08-01", end: "2026-10-31", dueDate: "2026-08-15" });
  });

  it("holds a quarterly charge to its window between two bills", () => {
    // Late September: the August bill is the current one, and it was paid.
    expect(currentPeriod(quarterly(15, 2), "2026-09-30").start).toBe("2026-08-01");
  });

  it("walks backwards when the year's first cycle has not arrived", () => {
    // Anchored in October, asked in March: the live cycle began last October.
    expect(currentPeriod(yearly(15, 10), "2026-03-04")).toEqual({
      start: "2025-10-01",
      end: "2026-09-30",
      dueDate: "2025-10-15",
    });
  });

  it("rolls a yearly charge over on the month it falls in", () => {
    expect(currentPeriod(yearly(15, 10), "2026-10-02").start).toBe("2026-10-01");
  });

  it("is the week, Monday to Sunday, for a weekly charge", () => {
    expect(currentPeriod({ cadence: "weekly", dueDay: null, dueMonth: null }, "2026-08-23")).toEqual({
      start: "2026-08-17",
      end: "2026-08-23",
      dueDate: null,
    });
  });

  it("keeps a charge due on the 31st inside February", () => {
    const period = currentPeriod(monthly(31), "2026-02-10");
    expect(period.dueDate).toBe("2026-02-28");
    expect(period.end).toBe("2026-02-28");
  });

  it("has no due date when the charge never said which day", () => {
    expect(currentPeriod(monthly(null), "2026-08-23").dueDate).toBeNull();
  });
});

describe("when it next falls due", () => {
  it("gives this period's date when it is still ahead", () => {
    expect(nextDueDate(monthly(28), "2026-08-23")).toBe("2026-08-28");
  });

  it("moves to the next period once the date has passed", () => {
    expect(nextDueDate(monthly(5), "2026-08-23")).toBe("2026-09-05");
  });

  it("moves a quarterly charge a quarter, not a month", () => {
    expect(nextDueDate(quarterly(15, 2), "2026-08-23")).toBe("2026-11-15");
  });

  it("moves a yearly charge a year", () => {
    expect(nextDueDate(yearly(15, 10), "2026-10-20")).toBe("2027-10-15");
  });

  it("says nothing rather than inventing a date", () => {
    expect(nextDueDate(monthly(null), "2026-08-23")).toBeNull();
  });
});

describe("putting cadences on one footing", () => {
  it("shares a yearly premium over the twelve months it commits", () => {
    // 150 euros once a year is 12,50 a month of commitment. Counted whole it
    // would report a household with no room left that has plenty.
    expect(monthlyShareCents(15_000, "yearly")).toBe(1_250);
    expect(monthlyShareCents(4_200, "quarterly")).toBe(1_400);
    expect(monthlyShareCents(90_000, "monthly")).toBe(90_000);
    // 52/12, not 4: four weeks a month loses a payment a year.
    expect(monthlyShareCents(1_000, "weekly")).toBe(4_333);
  });

  it("scales the other way for a yearly figure", () => {
    expect(yearlyShareCents(1_000, "monthly")).toBe(12_000);
    expect(yearlyShareCents(4_200, "quarterly")).toBe(16_800);
    expect(yearlyShareCents(15_000, "yearly")).toBe(15_000);
    expect(yearlyShareCents(1_000, "weekly")).toBe(52_000);
  });
});
