import { describe, it, expect } from "vitest";
import { monthlyPaymentCents, amortizationSchedule } from "./amortization";

describe("monthlyPaymentCents", () => {
  it("computes a standard fixed-rate payment", () => {
    // 200 000 € at 1.90% over 240 months ≈ 1001.21 €/month
    const pay = monthlyPaymentCents(20_000_000, 190, 240);
    expect(pay).toBeGreaterThan(100_000);
    expect(pay).toBeLessThan(101_000);
  });

  it("handles 0% interest as principal / term", () => {
    expect(monthlyPaymentCents(12_000, 0, 12)).toBe(1_000);
  });
});

describe("amortizationSchedule", () => {
  it("amortizes fully to a zero balance", () => {
    const rows = amortizationSchedule({
      principalCents: 20_000_000,
      interestRateBps: 190,
      termMonths: 240,
    });
    expect(rows.length).toBe(240);
    expect(rows[rows.length - 1].balanceCents).toBe(0);
    // interest dominates early, principal dominates late
    expect(rows[0].interestCents).toBeGreaterThan(rows[239].interestCents);
  });

  it("attaches monthly dates when a start date is given", () => {
    const rows = amortizationSchedule({
      principalCents: 12_000,
      interestRateBps: 0,
      termMonths: 3,
      startDate: "2026-01-15",
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
    expect(rows[2].balanceCents).toBe(0);
  });
});
