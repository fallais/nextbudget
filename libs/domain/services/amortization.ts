export type LoanInput = {
  principalCents: number;
  interestRateBps: number;
  termMonths: number;
  monthlyPaymentCents?: number | null;
  insuranceMonthlyCents?: number | null;
  feesCents?: number | null;
  startDate?: string | null;
};

export type LoanProgress = {
  paidCount: number;
  remainingCount: number;
  principalPaidCents: number;
  principalRemainingCents: number;
  interestPaidCents: number;
  /** Due date of the next instalment, or null once the loan is repaid. */
  nextDate: string | null;
};

export type LoanSummary = {
  /** Capital + interest only — what the amortization table pays down. */
  monthlyPaymentCents: number;
  /** What actually leaves the account each month, insurance included. */
  monthlyTotalCents: number;
  totalInterestCents: number;
  totalInsuranceCents: number;
  feesCents: number;
  /** Interest + insurance + fees: what borrowing costs on top of the capital. */
  totalCostCents: number;
  /** Capital + total cost: everything paid over the life of the loan. */
  totalPaidCents: number;
  termMonths: number;
  endDate: string | null;
  /** Where you are today. Null when no start date is set. */
  progress: LoanProgress | null;
};

export type AmortizationRow = {
  index: number; // 1-based month number
  date: string | null; // ISO yyyy-MM-dd if a start date is known
  paymentCents: number;
  interestCents: number;
  principalCents: number;
  balanceCents: number; // remaining balance after this payment
};

/** Standard fixed-rate monthly payment for a loan (rounded to cents). */
export function monthlyPaymentCents(
  principalCents: number,
  annualRateBps: number,
  termMonths: number,
): number {
  if (principalCents <= 0 || termMonths <= 0) return 0;
  const r = annualRateBps / 10000 / 12; // monthly rate
  if (r === 0) return Math.round(principalCents / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return Math.round((principalCents * r * factor) / (factor - 1));
}

/**
 * Build a monthly amortization schedule. If `monthlyPaymentCents` is omitted it
 * is derived from principal/rate/term. Stops when the balance reaches zero.
 */
export function amortizationSchedule(opts: {
  principalCents: number;
  interestRateBps: number;
  termMonths: number;
  monthlyPaymentCents?: number | null;
  startDate?: string | null;
}): AmortizationRow[] {
  const { principalCents, interestRateBps, termMonths } = opts;
  if (principalCents <= 0 || termMonths <= 0) return [];

  const r = interestRateBps / 10000 / 12;
  const payment =
    opts.monthlyPaymentCents && opts.monthlyPaymentCents > 0
      ? opts.monthlyPaymentCents
      : monthlyPaymentCents(principalCents, interestRateBps, termMonths);

  const startParts = opts.startDate
    ? (opts.startDate.split("-").map(Number) as [number, number, number])
    : null;
  let balance = principalCents;
  const rows: AmortizationRow[] = [];

  for (let i = 1; i <= termMonths && balance > 0; i++) {
    const interest = Math.round(balance * r);
    let principalPart = payment - interest;
    if (principalPart <= 0) break; // payment doesn't cover interest → never amortizes
    // The final scheduled month (or an overpayment) clears the remaining balance.
    if (i === termMonths || principalPart > balance) principalPart = balance;
    balance -= principalPart;

    let date: string | null = null;
    if (startParts) {
      const [y, m, d] = startParts;
      // UTC math avoids local-timezone drift; Date.UTC handles month/year overflow.
      date = new Date(Date.UTC(y, m - 1 + i, d)).toISOString().slice(0, 10);
    }
    rows.push({
      index: i,
      date,
      paymentCents: interest + principalPart,
      interestCents: interest,
      principalCents: principalPart,
      balanceCents: Math.max(0, balance),
    });
  }
  return rows;
}

/**
 * What a loan costs, and how far through it you are.
 *
 * The cost of borrowing is interest **plus** the assurance emprunteur and the
 * one-off fees — on a French mortgage the insurance alone is routinely a fifth
 * of the total, so interest by itself understates it badly.
 *
 * Returns null when principal, rate or term are missing: there is nothing
 * honest to compute without them.
 */
export function summarizeLoan(loan: LoanInput, today?: string): LoanSummary | null {
  const schedule = amortizationSchedule(loan);
  if (schedule.length === 0) return null;

  const insuranceMonthly = Math.max(0, loan.insuranceMonthlyCents ?? 0);
  const fees = Math.max(0, loan.feesCents ?? 0);
  const totalInterest = schedule.reduce((a, r) => a + r.interestCents, 0);
  const totalInsurance = insuranceMonthly * schedule.length;
  const totalCost = totalInterest + totalInsurance + fees;

  const summary: LoanSummary = {
    monthlyPaymentCents: schedule[0].paymentCents,
    monthlyTotalCents: schedule[0].paymentCents + insuranceMonthly,
    totalInterestCents: totalInterest,
    totalInsuranceCents: totalInsurance,
    feesCents: fees,
    totalCostCents: totalCost,
    totalPaidCents: loan.principalCents + totalCost,
    termMonths: schedule.length,
    endDate: schedule[schedule.length - 1].date,
    progress: null,
  };

  // Progress needs dated instalments; without a start date the schedule is
  // only a shape, not a position in time.
  if (schedule[0].date && today) {
    const paid = schedule.filter((r) => r.date !== null && r.date <= today);
    const next = schedule.find((r) => r.date !== null && r.date > today) ?? null;
    summary.progress = {
      paidCount: paid.length,
      remainingCount: schedule.length - paid.length,
      principalPaidCents: paid.reduce((a, r) => a + r.principalCents, 0),
      principalRemainingCents:
        paid.length > 0 ? paid[paid.length - 1].balanceCents : loan.principalCents,
      interestPaidCents: paid.reduce((a, r) => a + r.interestCents, 0),
      nextDate: next?.date ?? null,
    };
  }

  return summary;
}

/**
 * The loan's total monthly insurance.
 *
 * Assurance emprunteur is priced per borrower, so a couple's mortgage normally
 * carries two different premiums (different ages, different quotités). When any
 * per-borrower figure is stated those are the truth and the loan-level number is
 * ignored — it would otherwise be double-counted against the sum.
 *
 * Falls back to the single loan-level figure, which is all a solo borrower ever
 * needs and all that older rows have.
 */
export function insuranceMonthlyFrom(
  loanLevelCents: number | null | undefined,
  perBorrowerCents: readonly (number | null | undefined)[] = [],
): number {
  const stated = perBorrowerCents.filter((c): c is number => c != null);
  if (stated.length > 0) return stated.reduce((total, c) => total + c, 0);
  return loanLevelCents ?? 0;
}

/**
 * Whole months between signing a loan and its first instalment — the différé.
 *
 * Null when either date is missing or repayment starts in the same month, which
 * is the ordinary case: most loans amortise straight away.
 */
export function deferralMonthsBetween(
  signatureDate: string | null | undefined,
  startDate: string | null | undefined,
): number | null {
  if (!signatureDate || !startDate || startDate <= signatureDate) return null;
  const [sy, sm] = signatureDate.split("-").map(Number);
  const [ty, tm] = startDate.split("-").map(Number);
  const months = (ty - sy) * 12 + (tm - sm);
  return months > 0 ? months : null;
}

/**
 * The TAEG implied by a loan's own terms, in basis points.
 *
 * The taux nominal drives the amortization; the TAEG is what the offer
 * advertises, and it folds in the assurance emprunteur and the one-off fees.
 * Borrowers remember the TAEG — it is the bold number on the offer — so it is
 * the one they reach for when asked to "type the rate", which silently inflates
 * every instalment. Computing it here lets the app compare what was entered
 * against what the terms actually imply and say so.
 *
 * Method: the rate that discounts the real cash flows to zero. The borrower
 * receives the capital less any upfront fees, then pays the instalment plus
 * insurance every month. France quotes the TAEG as an equivalent annual rate,
 * so the monthly solution is compounded, not multiplied by twelve.
 *
 * Null when the loan is not described well enough to compute.
 */
export function impliedTaegBps(loan: LoanInput): number | null {
  const schedule = amortizationSchedule(loan);
  if (schedule.length === 0) return null;

  const insurance = Math.max(0, loan.insuranceMonthlyCents ?? 0);
  const fees = Math.max(0, loan.feesCents ?? 0);
  // What actually lands in the borrower's account on day one.
  const advanced = loan.principalCents - fees;
  if (advanced <= 0) return null;

  const flows = schedule.map((row) => row.paymentCents + insurance);
  const npv = (monthly: number): number =>
    flows.reduce((sum, cf, k) => sum + cf / Math.pow(1 + monthly, k + 1), 0) - advanced;

  // NPV falls monotonically as the rate rises, so bisection is safe here.
  let lo = 0;
  let hi = 1; // 100%/month — far above any real consumer loan
  if (npv(lo) < 0) return 0; // payments never even repay the capital
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  const monthly = (lo + hi) / 2;
  return Math.round((Math.pow(1 + monthly, 12) - 1) * 10000);
}
