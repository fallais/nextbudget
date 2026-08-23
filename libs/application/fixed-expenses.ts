import "server-only";
import { startOfMonth, endOfMonth, subMonths, format, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import { FixedExpenseEntity, CategoryEntity, TransactionEntity } from "@infrastructure/persistence/schemas";
import type {
  FixedExpense,
  FixedExpenseRow,
  CategoryRow,
  NewFixedExpense,
  TransactionRow,
} from "@domain/entities";
import type { FixedExpenseRepository } from "@domain/repositories";
import type { z } from "zod";
import { fixedExpenses } from "@infrastructure/persistence/repositories";
import { getCurrentUser } from "./auth";
import type { fixedExpenseInputSchema } from "./contracts/validation";
import { compileRule } from "@domain/services/categorization";
import { getScope, visibleAccountIds, applyAccountScope, applyOwnedScope } from "@application/scope";

export type FixedExpenseStatus = {
  fixedExpense: FixedExpenseRow;
  category: CategoryRow | null;
  matched: Pick<TransactionRow, "id" | "date" | "description" | "amountCents">[];
  paidAmountCents: number;
  state: "paid" | "pending" | "overdue" | "anomaly";
  variancePct: number | null;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

type MatchableTransaction = {
  id: number;
  date: string;
  description: string;
  normalized: string;
  amountCents: number;
};

/**
 * One charge, judged against the transactions of a month.
 *
 * Pulled out of the list query so a single charge's page costs one expense and
 * one month of transactions rather than every charge the household tracks.
 */
function statusOf(
  fx: FixedExpenseRow,
  category: CategoryRow | null,
  monthly: MatchableTransaction[],
  today: number,
): FixedExpenseStatus {
  const idle: FixedExpenseStatus = {
    fixedExpense: fx,
    category,
    matched: [],
    paidAmountCents: 0,
    state: "pending",
    variancePct: null,
  };
  if (!fx.isActive) return idle;

  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: fx.matchPattern,
    matchType: fx.matchType,
    amountCondition: "negative",
    priority: 0,
  });
  if (!compiled) return idle;

  const matched = monthly
    .filter((t) => compiled.test(t.normalized, t.amountCents))
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amountCents: t.amountCents,
    }));
  const paid = matched.reduce((a, t) => a + Math.abs(t.amountCents), 0);
  const expected = fx.expectedAmountCents;
  const variance = paid === 0 ? null : (paid - expected) / expected;

  let state: FixedExpenseStatus["state"];
  if (matched.length === 0) {
    const due = fx.dueDay;
    state = due !== null && today > due + 5 ? "overdue" : "pending";
  } else if (variance !== null && Math.abs(variance) * 100 > fx.tolerancePct) {
    state = "anomaly";
  } else {
    state = "paid";
  }

  return {
    fixedExpense: fx,
    category,
    matched,
    paidAmountCents: paid,
    state,
    variancePct: variance === null ? null : variance * 100,
  };
}

/** The month's transactions, in the shape the matcher wants. */
async function monthlyTransactions(now: Date): Promise<MatchableTransaction[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :start", { start: isoDate(startOfMonth(now)) })
    .andWhere("t.date <= :end", { end: isoDate(endOfMonth(now)) });
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  return (await qb.getMany()).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    normalized: t.normalizedDescription,
    amountCents: t.amountCents,
  }));
}

/** One charge with its status — `null` when it does not exist or is out of scope. */
export async function getFixedExpenseStatus(
  id: number,
  now: Date = new Date(),
): Promise<FixedExpenseStatus | null> {
  const ds = await getDataSource();
  const qb = ds.getRepository(FixedExpenseEntity).createQueryBuilder("f").where("f.id = :id", { id });
  applyOwnedScope(qb, "f", await getScope());
  const fx = await qb.getOne();
  if (!fx) return null;

  const category =
    fx.categoryId != null
      ? await ds.getRepository(CategoryEntity).findOne({ where: { id: fx.categoryId } })
      : null;

  return statusOf(fx, category, await monthlyTransactions(now), now.getDate());
}

export type FixedExpenseMonth = {
  month: string;
  paidCents: number;
  count: number;
};

/**
 * What this charge actually cost, month by month.
 *
 * A fixed expense is only fixed until it is not — an index-linked rent, a
 * yearly insurance rise, a forgotten direct debit. Twelve months of it says
 * more than one month against a figure you typed in once.
 */
export async function getFixedExpenseHistory(
  id: number,
  months = 12,
  now: Date = new Date(),
): Promise<FixedExpenseMonth[]> {
  const ds = await getDataSource();
  const qb = ds.getRepository(FixedExpenseEntity).createQueryBuilder("f").where("f.id = :id", { id });
  applyOwnedScope(qb, "f", await getScope());
  const fx = await qb.getOne();
  if (!fx) return [];

  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: fx.matchPattern,
    matchType: fx.matchType,
    amountCondition: "negative",
    priority: 0,
  });
  if (!compiled) return [];

  const from = startOfMonth(subMonths(now, months - 1));
  const txQb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :from", { from: isoDate(from) })
    .andWhere("t.date <= :to", { to: isoDate(endOfMonth(now)) });
  applyAccountScope(txQb, "t", await visibleAccountIds(await getScope()));

  const buckets = new Map<string, { paidCents: number; count: number }>();
  for (const t of await txQb.getMany()) {
    if (!compiled.test(t.normalizedDescription, t.amountCents)) continue;
    const key = t.date.slice(0, 7);
    const bucket = buckets.get(key) ?? { paidCents: 0, count: 0 };
    bucket.paidCents += Math.abs(t.amountCents);
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  // Months with nothing are zeros, not gaps: a missed direct debit is the
  // whole point of looking.
  return Array.from({ length: months }, (_, i) => {
    const month = format(startOfMonth(subMonths(now, months - 1 - i)), "yyyy-MM");
    const bucket = buckets.get(month);
    return { month, paidCents: bucket?.paidCents ?? 0, count: bucket?.count ?? 0 };
  });
}

export async function getFixedExpensesWithStatus(
  now: Date = new Date(),
): Promise<FixedExpenseStatus[]> {
  const ds = await getDataSource();
  const fxQb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(fxQb, "f", await getScope());
  const fxList = await fxQb.getMany();
  if (fxList.length === 0) return [];

  const cats = await ds.getRepository(CategoryEntity).find();
  const catMap = new Map(cats.map((c) => [c.id, c]));

  // One month of transactions for the whole list, matched in memory: the
  // patterns are regexes and `contains` on a normalised label, which Postgres
  // cannot index anyway.
  const monthly = await monthlyTransactions(now);
  const today = now.getDate();
  return fxList.map((fx) =>
    statusOf(fx, fx.categoryId != null ? (catMap.get(fx.categoryId) ?? null) : null, monthly, today),
  );
}

export type FixedExpensesSummary = {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  anomaly: number;
  expectedTotalCents: number;
  paidTotalCents: number;
};

export function summarizeFixedExpenses(
  statuses: FixedExpenseStatus[],
): FixedExpensesSummary {
  const summary: FixedExpensesSummary = {
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    anomaly: 0,
    expectedTotalCents: 0,
    paidTotalCents: 0,
  };
  for (const s of statuses) {
    if (!s.fixedExpense.isActive) continue;
    summary.total++;
    summary[s.state]++;
    summary.expectedTotalCents += s.fixedExpense.expectedAmountCents;
    summary.paidTotalCents += s.paidAmountCents;
  }
  return summary;
}

/**
 * Fixed expenses visible to the current scope, in the order the UI shows them:
 * by due day, then name. A no-op filter in open mode.
 */
export async function listFixedExpenses(): Promise<FixedExpenseRow[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(qb, "f", await getScope());
  return qb.getMany();
}


export type FixedExpenseDeps = {
  fixedExpenses: Pick<FixedExpenseRepository, "create" | "update" | "delete">;
  currentUserId: () => Promise<number | null>;
};

const LIVE: FixedExpenseDeps = {
  fixedExpenses,
  currentUserId: async () => (await getCurrentUser())?.id ?? null,
};

export type FixedExpenseInput = z.infer<typeof fixedExpenseInputSchema>;

/**
 * Record a bill that comes round every month.
 *
 * `liabilityId` is null on creation: linking a charge to the credit it repays
 * happens later, from the credit, and letting it be set here would allow two
 * places to disagree about which loan a charge belongs to.
 */
export async function createFixedExpense(
  input: FixedExpenseInput,
  deps: FixedExpenseDeps = LIVE,
): Promise<FixedExpenseRow> {
  const created = await deps.fixedExpenses.create({
    ownerId: await deps.currentUserId(),
    visibility: "shared",
    name: input.name,
    categoryId: input.categoryId,
    liabilityId: null,
    expectedAmountCents: input.expectedAmountCents,
    tolerancePct: input.tolerancePct,
    dueDay: input.dueDay,
    matchPattern: input.matchPattern,
    matchType: input.matchType,
    isActive: input.isActive,
    notes: input.notes ?? null,
  });
  return created.toRow();
}

/** Resolves `null` when no fixed expense has that id. */
export async function updateFixedExpense(
  fixedExpenseId: number,
  patch: Partial<FixedExpenseInput>,
  deps: FixedExpenseDeps = LIVE,
): Promise<FixedExpenseRow | null> {
  const updated = await deps.fixedExpenses.update(fixedExpenseId, patch);
  return updated?.toRow() ?? null;
}

/** Resolves `false` when there was nothing to delete. */
export async function deleteFixedExpense(
  fixedExpenseId: number,
  deps: FixedExpenseDeps = LIVE,
): Promise<boolean> {
  return deps.fixedExpenses.delete(fixedExpenseId);
}

export type { FixedExpense, NewFixedExpense };
