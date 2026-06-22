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
