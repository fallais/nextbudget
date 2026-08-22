import "server-only";
import { startOfMonth, endOfMonth, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { AccountEntity, ContributionEntity, PersonEntity, TransactionEntity } from "@infrastructure/persistence/schemas";
import type { ContributionRow, PersonRow, TransactionRow } from "@domain/entities";
import { compileRule } from "@domain/services/categorization";
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
