/**
 * Reconciling apports settled in a lump.
 *
 * Money reaches the common pot in two shapes: one transfer per apport, which
 * matches its pattern and needs nothing from this file — and a catch-up
 * covering several skipped months at once, labelled `Virements manquants` or
 * whatever the payer typed that day. The second kind matches no apport, so
 * without this the months it settled read as never paid, and the page reports
 * a household in arrears that is square.
 *
 * What it does *not* do is decide which apport a lump paid, because that is
 * not knowable: 910 € arriving against four missing apports says the money
 * came, not which four hundred of it was the groceries. So the rule is a
 * budget, not an attribution — a shortfall is marked covered only while the
 * month's unclaimed money can pay for it, and the reader is told which
 * transfer did the covering so the inference stays checkable.
 *
 * Pure, so the arithmetic that decides whether you owe money can be tested
 * without a database.
 */

export type CoverableMonth = {
  month: string;
  state: string;
  receivedCents: number;
};

export type Coverable<T extends CoverableMonth> = {
  /** What this apport is owed each month. */
  expectedAmountCents: number;
  months: T[];
};

/**
 * Turn `missed` months into `covered` while the month's unclaimed money lasts.
 *
 * Largest shortfall first. Any order is a convention — the lump does not say
 * what it paid — and this one spends the pool on what it can actually settle
 * rather than exhausting it on small lines and leaving a big one red.
 *
 * Returns what each month had left over, which is the figure to show beside
 * the strip: it is the evidence for every square this changed.
 */
export function coverFromPool<M extends CoverableMonth, T extends Coverable<M>>(
  contributions: T[],
  poolByMonth: ReadonlyMap<string, number>,
): Map<string, number> {
  const remaining = new Map(poolByMonth);
  const months = new Set<string>();
  for (const c of contributions) for (const m of c.months) months.add(m.month);

  for (const month of [...months].sort()) {
    let pool = remaining.get(month) ?? 0;
    if (pool <= 0) continue;

    const shortfalls = contributions
      .map((c) => ({ c, m: c.months.find((m) => m.month === month) }))
      .filter((x): x is { c: T; m: M } => !!x.m && x.m.state === "missed")
      .sort((a, b) => b.c.expectedAmountCents - a.c.expectedAmountCents);

    for (const { c, m } of shortfalls) {
      if (pool < c.expectedAmountCents) continue;
      pool -= c.expectedAmountCents;
      m.state = "covered";
    }
    remaining.set(month, pool);
  }
  return remaining;
}
