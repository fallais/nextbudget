import { describe, it, expect } from "vitest";
import {
  monthlyPaymentCents,
  amortizationSchedule,
  summarizeLoan,
  insuranceMonthlyFrom,
  deferralMonthsBetween,
  impliedTaegBps,
} from "./amortization";

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

describe("summarizeLoan", () => {
  // 200 000 € at 1.90% over 240 months, 25 €/month insurance, 1 500 € of fees.
  const loan = {
    principalCents: 20_000_000,
    interestRateBps: 190,
    termMonths: 240,
    insuranceMonthlyCents: 2_500,
    feesCents: 150_000,
    startDate: "2020-01-10",
  };

  it("counts insurance and fees in the cost of borrowing, not just interest", () => {
    const s = summarizeLoan(loan)!;
    expect(s.totalInsuranceCents).toBe(2_500 * 240); // 6 000 €
    expect(s.feesCents).toBe(150_000);
    expect(s.totalCostCents).toBe(
      s.totalInterestCents + s.totalInsuranceCents + s.feesCents,
    );
    // Insurance + fees are a real share of the total, not a rounding detail.
    expect(s.totalCostCents).toBeGreaterThan(s.totalInterestCents);
    expect(s.totalPaidCents).toBe(loan.principalCents + s.totalCostCents);
  });

  it("separates the loan payment from what actually leaves the account", () => {
    const s = summarizeLoan(loan)!;
    expect(s.monthlyTotalCents).toBe(s.monthlyPaymentCents + 2_500);
  });

  it("reports progress against a date", () => {
    // Five years in: 60 of 240 instalments paid.
    const s = summarizeLoan(loan, "2025-01-15")!;
    expect(s.progress?.paidCount).toBe(60);
    expect(s.progress?.remainingCount).toBe(180);
    expect(s.progress?.nextDate).toBe("2025-02-10");
    // Capital repaid plus capital outstanding is the whole loan.
    expect(
      s.progress!.principalPaidCents + s.progress!.principalRemainingCents,
    ).toBe(loan.principalCents);
    // Early in a mortgage, interest paid is a large share of what you've paid.
    expect(s.progress!.interestPaidCents).toBeGreaterThan(0);
  });

  it("has no progress before the first instalment or without a start date", () => {
    expect(summarizeLoan(loan, "2019-06-01")!.progress?.paidCount).toBe(0);
    expect(summarizeLoan({ ...loan, startDate: null }, "2025-01-15")!.progress).toBeNull();
    expect(summarizeLoan(loan)!.progress).toBeNull();
  });

  it("treats a loan with no insurance or fees as interest-only cost", () => {
    const s = summarizeLoan({
      principalCents: 12_000,
      interestRateBps: 0,
      termMonths: 12,
    })!;
    expect(s.totalInterestCents).toBe(0);
    expect(s.totalCostCents).toBe(0);
    expect(s.totalPaidCents).toBe(12_000);
    expect(s.monthlyTotalCents).toBe(s.monthlyPaymentCents);
  });

  it("returns null when the loan is not described well enough to compute", () => {
    expect(summarizeLoan({ principalCents: 0, interestRateBps: 190, termMonths: 240 })).toBeNull();
    expect(summarizeLoan({ principalCents: 1000, interestRateBps: 190, termMonths: 0 })).toBeNull();
  });
});

describe("insuranceMonthlyFrom", () => {
  it("sums the per-borrower premiums when they are stated", () => {
    // A couple's mortgage: different ages, different quotités, so the two
    // premiums genuinely differ.
    expect(insuranceMonthlyFrom(null, [18_40, 24_60])).toBe(43_00);
  });

  it("ignores the loan-level figure once borrowers have their own", () => {
    // Otherwise the whole-loan premium would be added on top of the parts and
    // double the insurance in the cost.
    expect(insuranceMonthlyFrom(99_00, [18_40, 24_60])).toBe(43_00);
  });

  it("counts only the borrowers who have a premium recorded", () => {
    expect(insuranceMonthlyFrom(99_00, [18_40, null])).toBe(18_40);
  });

  it("falls back to the loan-level figure for a solo borrower", () => {
    expect(insuranceMonthlyFrom(31_00, [])).toBe(31_00);
    expect(insuranceMonthlyFrom(31_00, [null, null])).toBe(31_00);
  });

  it("is zero when nothing is known", () => {
    expect(insuranceMonthlyFrom(null, [])).toBe(0);
  });
});

describe("deferralMonthsBetween", () => {
  it("counts the months of a crédit différé", () => {
    expect(deferralMonthsBetween("2024-03-15", "2026-01-05")).toBe(22);
  });

  it("is null when repayment starts in the signature month", () => {
    expect(deferralMonthsBetween("2024-03-01", "2024-03-28")).toBeNull();
  });

  it("is null when a date is missing — nothing to measure between", () => {
    expect(deferralMonthsBetween(null, "2026-01-05")).toBeNull();
    expect(deferralMonthsBetween("2024-03-15", null)).toBeNull();
  });

  it("refuses a first instalment that precedes the signature", () => {
    expect(deferralMonthsBetween("2026-01-05", "2024-03-15")).toBeNull();
  });
});

describe("impliedTaegBps", () => {
  // Round, invented figures: 200 000 € at a taux nominal of 1,50% over 240
  // months, insured at 30 €/month.
  const loan = {
    principalCents: 200_000_00,
    interestRateBps: 150,
    termMonths: 240,
    insuranceMonthlyCents: 30_00,
  };

  it("is above the nominal rate, because insurance and fees are the difference", () => {
    expect(impliedTaegBps(loan)!).toBeGreaterThan(loan.interestRateBps);
  });

  it("rises again once upfront fees are added", () => {
    const withoutFees = impliedTaegBps(loan)!;
    const withFees = impliedTaegBps({ ...loan, feesCents: 2_000_00 })!;
    expect(withFees).toBeGreaterThan(withoutFees);
  });

  it("stays close to the nominal rate when there is no insurance and no fee", () => {
    const bare = { principalCents: 200_000_00, interestRateBps: 190, termMonths: 240 };
    // Equivalent-annual compounding of the monthly rate puts it a touch above
    // the quoted nominal, which is exactly what the French definition does.
    const taeg = impliedTaegBps(bare)!;
    expect(taeg).toBeGreaterThanOrEqual(190);
    expect(taeg).toBeLessThan(196);
  });

  it("rises with the insurance premium", () => {
    const low = impliedTaegBps({ ...loan, insuranceMonthlyCents: 10_00 })!;
    const high = impliedTaegBps({ ...loan, insuranceMonthlyCents: 80_00 })!;
    expect(high).toBeGreaterThan(low);
  });

  it("returns null for a loan it cannot describe", () => {
    expect(impliedTaegBps({ principalCents: 0, interestRateBps: 150, termMonths: 240 })).toBeNull();
  });
});
