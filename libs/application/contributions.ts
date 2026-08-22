import "server-only";
import { startOfMonth, endOfMonth, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { AccountEntity, ContributionEntity, PersonEntity, TransactionEntity } from "@infrastructure/persistence/schemas";
import type { ContributionRow, PersonRow, TransactionRow } from "@domain/entities";
import { compileRule } from "@domain/services/categorization";
import { coverFromPool } from "@application/consolidation";
import { getScope, visibleAccountIds, applyAccountScope, applyOwnedScope } from "@application/scope";

export type ContributionStatus = {
  contribution: ContributionRow;
  matched: Pick<TransactionRow, "id" | "date" | "description" | "amountCents">[];
  receivedCents: number;
  state: "received" | "pending" | "anomaly";
  variancePct: number | null;
};

export type PersonWithStatus = {
  person: PersonRow;
  contributions: ContributionStatus[];
  /**
   * Switched off, so absent from the month's dues above — but still listed,
   * separately, or an apport put on hold would be unreachable to turn back on.
   */
  inactive: ContributionRow[];
  expectedTotalCents: number;
  receivedByContribCents: number;
  receivedByBroadCents: number | null;
  receivedTotalCents: number;
  isConsolidated: boolean;
};

type MonthlyTx = {
  id: number;
  date: string;
  description: string;
  normalized: string;
  amountCents: number;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export async function listPersons(): Promise<PersonRow[]> {
  const ds = await getDataSource();
  return ds.getRepository(PersonEntity).find({ order: { name: "ASC" } });
}

export async function listContributions(): Promise<ContributionRow[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(ContributionEntity)
    .createQueryBuilder("c")
    .orderBy("c.person_id", "ASC")
    .addOrderBy("c.name", "ASC");
  applyOwnedScope(qb, "c", await getScope());
  return qb.getMany();
}

/**
 * The accounts a contribution can be matched against.
 *
 * An "apport" is money arriving in the household's common pot, so only joint
 * accounts should count: a salary landing in someone's personal account can
 * otherwise match their own contribution pattern and mark the month as paid.
 *
 * Falls back to every visible account when no account is marked joint, which
 * keeps installs that predate the personal/joint distinction — and solo ones —
 * behaving exactly as before.
 */
async function matchableAccountIds(): Promise<number[] | null> {
  const scope = await getScope();
  const visible = await visibleAccountIds(scope);
  const ds = await getDataSource();
  const qb = ds
    .getRepository(AccountEntity)
    .createQueryBuilder("a")
    .select("a.id", "id")
    .where("a.kind = :kind", { kind: "joint" });
  applyOwnedScope(qb, "a", scope);
  const joint = (await qb.getRawMany<{ id: number }>()).map((r) => Number(r.id));
  if (joint.length === 0) return visible;
  return visible === null ? joint : joint.filter((id) => visible.includes(id));
}

export async function getContributionsByPersonWithStatus(
  now: Date = new Date(),
): Promise<PersonWithStatus[]> {
  const start = isoDate(startOfMonth(now));
  const end = isoDate(endOfMonth(now));

  const allPersons = await listPersons();
  if (allPersons.length === 0) return [];

  const allContribs = await listContributions();
  const ds = await getDataSource();
  const monthlyQb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :start", { start })
    .andWhere("t.date <= :end", { end });
  applyAccountScope(monthlyQb, "t", await matchableAccountIds());
  const monthlyRows = await monthlyQb.getMany();
  const monthlyTxs: MonthlyTx[] = monthlyRows.map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    normalized: t.normalizedDescription,
    amountCents: t.amountCents,
  }));

  const byPerson = new Map<number, ContributionStatus[]>();
  const inactiveByPerson = new Map<number, ContributionRow[]>();
  for (const c of allContribs) {
    // Switched off is switched off. Listing one alongside this month's dues
    // read as "still owed" — it has no state a month can put it in, and the
    // totals beneath the table already left it out, so the row disagreed with
    // its own summary.
    if (!c.isActive) {
      inactiveByPerson.set(c.personId, [...(inactiveByPerson.get(c.personId) ?? []), c]);
      continue;
    }
    const arr = byPerson.get(c.personId) ?? [];
    arr.push(computeStatus(c, monthlyTxs));
    byPerson.set(c.personId, arr);
  }

  // First-match-wins broad attribution: a positive transaction can only count
  // toward a single person's broad total. Iterate persons in id order so the
  // person created first claims contested matches (e.g. "DE JEAN - ESSENCE
  // MARTIN" contains both JEAN and MARTIN — attribute to Jean, not Martin).
  const claimedTxIds = new Set<number>();
  const broadByPerson = new Map<number, number>();
  for (const p of allPersons) {
    if (!p.matchPattern || p.matchPattern.trim().length === 0) continue;
    const compiled = compileRule({
      id: 0,
      categoryId: 0,
      pattern: p.matchPattern,
      matchType: p.matchType ?? "contains",
      amountCondition: "positive",
      priority: 0,
    });
    if (!compiled) continue;
    let sum = 0;
    for (const t of monthlyTxs) {
      if (claimedTxIds.has(t.id)) continue;
      if (compiled.test(t.normalized, t.amountCents)) {
        claimedTxIds.add(t.id);
        sum += Math.abs(t.amountCents);
      }
    }
    broadByPerson.set(p.id, sum);
  }

  const out: PersonWithStatus[] = [];
  for (const p of allPersons) {
    const list = byPerson.get(p.id) ?? [];
    const expectedTotal = list.reduce((a, s) => a + s.contribution.expectedAmountCents, 0);
    const byContribTotal = list.reduce((a, s) => a + s.receivedCents, 0);

    const hasBroad = p.matchPattern && p.matchPattern.trim().length > 0;
    const byBroadTotal: number | null = hasBroad ? (broadByPerson.get(p.id) ?? 0) : null;

    const trueTotal =
      byBroadTotal !== null ? Math.max(byContribTotal, byBroadTotal) : byContribTotal;
    const isConsolidated = byBroadTotal !== null && byBroadTotal > byContribTotal + 50; // > 0.50 €

    out.push({
      person: p,
      contributions: list,
      inactive: inactiveByPerson.get(p.id) ?? [],
      expectedTotalCents: expectedTotal,
      receivedByContribCents: byContribTotal,
      receivedByBroadCents: byBroadTotal,
      receivedTotalCents: trueTotal,
      isConsolidated,
    });
  }
  return out;
}

/** Only called for active contributions — the caller drops the rest. */
function computeStatus(c: ContributionRow, monthlyTxs: MonthlyTx[]): ContributionStatus {
  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: c.matchPattern,
    matchType: c.matchType,
    amountCondition: "positive",
    priority: 0,
  });
  if (!compiled) {
    return { contribution: c, matched: [], receivedCents: 0, state: "pending", variancePct: null };
  }
  const matched = monthlyTxs
    .filter((t) => compiled.test(t.normalized, t.amountCents))
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amountCents: t.amountCents,
    }));
  const received = matched.reduce((a, t) => a + Math.abs(t.amountCents), 0);
  const expected = c.expectedAmountCents;
  const variance = received === 0 ? null : (received - expected) / expected;
  let state: ContributionStatus["state"];
  if (matched.length === 0) state = "pending";
  else if (variance !== null && Math.abs(variance) * 100 > c.tolerancePct) state = "anomaly";
  else state = "received";
  return {
    contribution: c,
    matched,
    receivedCents: received,
    state,
    variancePct: variance === null ? null : variance * 100,
  };
}

export type ContributionsGlobalSummary = {
  totalExpectedCents: number;
  totalReceivedCents: number;
  personsCount: number;
  receivedCount: number;
  pendingCount: number;
  anomalyCount: number;
};

export function summarizeContributions(
  perPerson: PersonWithStatus[],
): ContributionsGlobalSummary {
  let expected = 0;
  let received = 0;
  let r = 0;
  let p = 0;
  let a = 0;
  for (const pp of perPerson) {
    expected += pp.expectedTotalCents;
    received += pp.receivedTotalCents;
    for (const c of pp.contributions) {
      if (!c.contribution.isActive) continue;
      if (c.state === "received") r++;
      else if (c.state === "pending") p++;
      else if (c.state === "anomaly") a++;
    }
  }
  return {
    totalExpectedCents: expected,
    totalReceivedCents: received,
    personsCount: perPerson.length,
    receivedCount: r,
    pendingCount: p,
    anomalyCount: a,
  };
}

// ── History ──────────────────────────────────────────────────────────────────

/**
 * What happened to one apport in one month.
 *
 * `before` is not a failure: an apport that started in 2023 was not owed in
 * 2022, and colouring those months as missed would bury the ones that are.
 * `pending` is the current month, which has not finished yet.
 */
export type MonthState =
  | "received"
  | "anomaly"
  /** Nothing matched, and the payer sent nothing unaccounted for either. */
  | "missed"
  /** Nothing matched, but a lump from the same person covers it. */
  | "covered"
  | "pending"
  | "before";

export type ContributionMonth = {
  /** "YYYY-MM". */
  month: string;
  receivedCents: number;
  state: MonthState;
};

export type ContributionHistory = {
  contribution: ContributionRow;
  /** Oldest first, one entry per month of the window. */
  months: ContributionMonth[];
  /** Totals over the months this apport was actually owed. */
  expectedCents: number;
  receivedCents: number;
  missedCount: number;
  lastReceivedMonth: string | null;
};

export type PersonHistory = {
  person: PersonRow;
  contributions: ContributionHistory[];
  inactive: ContributionRow[];
  expectedCents: number;
  receivedCents: number;
  missedCount: number;
  /**
   * Money this person sent that no apport claimed, per month, after covering
   * what it could. Zero everywhere until the person has a `matchPattern` —
   * without one there is no way to tell their transfers from anyone else's.
   */
  unclaimedByMonth: Record<string, number>;
  /** True once any month was settled by a lump rather than line by line. */
  hasConsolidated: boolean;
};

function monthsEnding(now: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/**
 * Every apport over a window of months, and which of them went unpaid.
 *
 * The month view answers "are we square this month"; this answers "has this
 * ever not arrived", which is the question that finds the one nobody noticed
 * stopping. A month only counts against an apport once it has been paid at
 * least once — before that there was nothing to expect.
 */
export async function getContributionHistory(
  monthsBack = 12,
  now: Date = new Date(),
): Promise<PersonHistory[]> {
  const window = monthsEnding(now, monthsBack);
  const currentMonth = window[window.length - 1];
  const from = `${window[0]}-01`;

  const allPersons = await listPersons();
  if (allPersons.length === 0) return [];
  const allContribs = await listContributions();

  const ds = await getDataSource();
  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :from", { from })
    .andWhere("t.amount_cents > 0");
  applyAccountScope(qb, "t", await matchableAccountIds());
  const txs = (await qb.getMany()).map((t) => ({
    id: t.id,
    month: t.date.slice(0, 7),
    normalized: t.normalizedDescription,
    amountCents: t.amountCents,
  }));
  // Anything an apport recognised is spoken for; only what is left can be a
  // catch-up, or the same euros would be counted twice.
  const claimed = new Set<number>();

  const byPerson = new Map<number, ContributionHistory[]>();
  const inactiveByPerson = new Map<number, ContributionRow[]>();

  for (const c of allContribs) {
    if (!c.isActive) {
      inactiveByPerson.set(c.personId, [...(inactiveByPerson.get(c.personId) ?? []), c]);
      continue;
    }
    const compiled = compileRule({
      id: 0,
      categoryId: 0,
      pattern: c.matchPattern,
      matchType: c.matchType,
      amountCondition: "positive",
      priority: 0,
    });

    const receivedByMonth = new Map<string, number>();
    if (compiled) {
      for (const t of txs) {
        if (!compiled.test(t.normalized, t.amountCents)) continue;
        claimed.add(t.id);
        receivedByMonth.set(t.month, (receivedByMonth.get(t.month) ?? 0) + Math.abs(t.amountCents));
      }
    }
    const firstPaid = window.find((m) => (receivedByMonth.get(m) ?? 0) > 0) ?? null;

    const months: ContributionMonth[] = window.map((month) => {
      const received = receivedByMonth.get(month) ?? 0;
      if (received > 0) {
        const variance = Math.abs(received - c.expectedAmountCents) / c.expectedAmountCents;
        return {
          month,
          receivedCents: received,
          state: variance * 100 > c.tolerancePct ? "anomaly" : "received",
        };
      }
      if (firstPaid === null || month < firstPaid) return { month, receivedCents: 0, state: "before" };
      return { month, receivedCents: 0, state: month === currentMonth ? "pending" : "missed" };
    });

    const owed = months.filter((m) => m.state !== "before");
    byPerson.set(c.personId, [
      ...(byPerson.get(c.personId) ?? []),
      {
        contribution: c,
        months,
        expectedCents: owed.length * c.expectedAmountCents,
        receivedCents: months.reduce((a, m) => a + m.receivedCents, 0),
        missedCount: months.filter((m) => m.state === "missed").length,
        lastReceivedMonth:
          [...months].reverse().find((m) => m.receivedCents > 0)?.month ?? null,
      },
    ]);
  }

  // Persons in id order, and each transaction claimable once: "DE FRANCOIS -
  // ESSENCE MARTIN" carries two names, and letting both claim it would credit
  // the same euros to two people.
  return allPersons.map((person) => {
    const list = byPerson.get(person.id) ?? [];

    const pool = new Map<string, number>();
    const broad = person.matchPattern?.trim()
      ? compileRule({
          id: 0,
          categoryId: 0,
          pattern: person.matchPattern,
          matchType: person.matchType ?? "contains",
          amountCondition: "positive",
          priority: 0,
        })
      : null;
    if (broad) {
      for (const t of txs) {
        if (claimed.has(t.id)) continue;
        if (!broad.test(t.normalized, t.amountCents)) continue;
        claimed.add(t.id);
        pool.set(t.month, (pool.get(t.month) ?? 0) + Math.abs(t.amountCents));
      }
    }

    const leftover = coverFromPool(
      list.map((c) => ({ expectedAmountCents: c.contribution.expectedAmountCents, months: c.months })),
      pool,
    );
    // Counted after covering: a month a lump settled is not a month in arrears.
    for (const c of list) c.missedCount = c.months.filter((m) => m.state === "missed").length;

    return {
      person,
      contributions: list,
      inactive: inactiveByPerson.get(person.id) ?? [],
      expectedCents: list.reduce((a, c) => a + c.expectedCents, 0),
      receivedCents: list.reduce((a, c) => a + c.receivedCents, 0),
      missedCount: list.reduce((a, c) => a + c.missedCount, 0),
      unclaimedByMonth: Object.fromEntries([...leftover].filter(([, v]) => v > 0)),
      hasConsolidated: list.some((c) => c.months.some((m) => m.state === "covered")),
    };
  });
}
