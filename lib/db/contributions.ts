import "server-only";
import { startOfMonth, endOfMonth, formatISO } from "date-fns";
import { getDataSource } from "./client";
import {
  ContributionEntity,
  PersonEntity,
  TransactionEntity,
  type Contribution,
  type Person,
  type Transaction,
} from "./entities";
import { compileRule } from "@/lib/categorize/core";
import { getScope, visibleAccountIds, applyAccountScope, applyOwnedScope } from "./scope";

export type ContributionStatus = {
  contribution: Contribution;
  matched: Pick<Transaction, "id" | "date" | "description" | "amountCents">[];
  receivedCents: number;
  state: "received" | "pending" | "anomaly";
  variancePct: number | null;
};

export type PersonWithStatus = {
  person: Person;
  contributions: ContributionStatus[];
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

export async function listPersons(): Promise<Person[]> {
  const ds = await getDataSource();
  return ds.getRepository(PersonEntity).find({ order: { name: "ASC" } });
}

export async function listContributions(): Promise<Contribution[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(ContributionEntity)
    .createQueryBuilder("c")
    .orderBy("c.person_id", "ASC")
    .addOrderBy("c.name", "ASC");
  applyOwnedScope(qb, "c", await getScope());
  return qb.getMany();
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
  applyAccountScope(monthlyQb, "t", await visibleAccountIds(await getScope()));
  const monthlyRows = await monthlyQb.getMany();
  const monthlyTxs: MonthlyTx[] = monthlyRows.map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    normalized: t.normalizedDescription,
    amountCents: t.amountCents,
  }));

  const byPerson = new Map<number, ContributionStatus[]>();
  for (const c of allContribs) {
    const status = computeStatus(c, monthlyTxs);
    const arr = byPerson.get(c.personId) ?? [];
    arr.push(status);
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
    const active = list.filter((s) => s.contribution.isActive);
    const expectedTotal = active.reduce((a, s) => a + s.contribution.expectedAmountCents, 0);
    const byContribTotal = active.reduce((a, s) => a + s.receivedCents, 0);

    const hasBroad = p.matchPattern && p.matchPattern.trim().length > 0;
    const byBroadTotal: number | null = hasBroad ? (broadByPerson.get(p.id) ?? 0) : null;

    const trueTotal =
      byBroadTotal !== null ? Math.max(byContribTotal, byBroadTotal) : byContribTotal;
    const isConsolidated = byBroadTotal !== null && byBroadTotal > byContribTotal + 50; // > 0.50 €

    out.push({
      person: p,
      contributions: list,
      expectedTotalCents: expectedTotal,
      receivedByContribCents: byContribTotal,
      receivedByBroadCents: byBroadTotal,
      receivedTotalCents: trueTotal,
      isConsolidated,
    });
  }
  return out;
}

function computeStatus(c: Contribution, monthlyTxs: MonthlyTx[]): ContributionStatus {
  if (!c.isActive) {
    return { contribution: c, matched: [], receivedCents: 0, state: "pending", variancePct: null };
  }
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
