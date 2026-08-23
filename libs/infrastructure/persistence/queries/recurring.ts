import "server-only";
import { startOfMonth, subMonths, formatISO } from "date-fns";
import { getDataSource } from "@infrastructure/persistence/client";
import {
  CategoryEntity,
  FixedExpenseEntity,
  RecurringDismissalEntity,
  TransactionEntity,
} from "@infrastructure/persistence/schemas";
import type { CategoryRow } from "@domain/entities";
import { compileRule } from "@domain/services/categorization";
import {
  amountDrift,
  detectRecurrence,
  monthlyCostCents,
  recurrenceKey,
  suggestPattern,
  suggestedTolerancePct,
  type AmountDrift,
  type Recurrence,
} from "@domain/services/recurrence";
import { visibleAccountIds, applyAccountScope, applyOwnedScope } from "./scope";
import { excludeTransfers } from "./transfers";
import { getScope } from "@application/scope";

/**
 * Charges that repeat, found rather than declared.
 *
 * A frais fixe only helps once someone has typed it in, and the ones people
 * forget to type in are exactly the ones worth watching: the subscription
 * taken out for one film, the insurance that renews itself, the gym. The
 * ledger already knows about all of them.
 *
 * Nothing here writes: every candidate is an offer, and it becomes a frais
 * fixe only when someone confirms it. That is what makes a heuristic
 * acceptable at all, and why a wrong guess costs a click rather than a wrong
 * figure on the dashboard.
 */

export type RecurringCandidate = {
  key: string;
  /** The most recent label, because that is what a person recognises. */
  label: string;
  category: CategoryRow | null;
  recurrence: Recurrence;
  /** What it has done to your money since, when it has done anything. */
  drift: AmountDrift | null;
  /** On a monthly footing, so a yearly premium can be ranked against a gym. */
  monthlyCents: number;
  /** The pattern the frais fixe would be created with. */
  suggestedPattern: string;
  /** And the tolerance, taken from how much this charge actually wanders. */
  suggestedTolerancePct: number;
};

type Seen = {
  date: string;
  amountCents: number;
  normalized: string;
  description: string;
  categoryId: number | null;
};

function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** Eighteen months: enough for a yearly premium to show twice. */
const DEFAULT_MONTHS = 18;

async function ledger(months: number, now: Date, sign: "in" | "out"): Promise<Seen[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .where("t.date >= :from", { from: isoDate(startOfMonth(subMonths(now, months - 1))) })
    .andWhere(sign === "out" ? "t.amount_cents < 0" : "t.amount_cents > 0");
  applyAccountScope(qb, "t", await visibleAccountIds(await getScope()));
  // A standing order to your own livret repeats beautifully and is not a
  // charge; suggesting it as one would be suggesting you stop saving.
  excludeTransfers(qb, "t");

  return (await qb.getMany()).map((t) => ({
    date: t.date,
    amountCents: t.amountCents,
    normalized: t.normalizedDescription,
    description: t.description,
    categoryId: t.categoryId,
  }));
}

/** Group the ledger under the stable name of whatever is being charged. */
function groupByKey(rows: Seen[]): Map<string, Seen[]> {
  const groups = new Map<string, Seen[]>();
  for (const row of rows) {
    const key = recurrenceKey(row.normalized);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/** The category most of these were filed under, which is the one to suggest. */
function commonCategory(rows: Seen[], byId: Map<number, CategoryRow>): CategoryRow | null {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.categoryId == null) continue;
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [id, count] of counts) {
    if (best === null || count > counts.get(best)! || (count === counts.get(best)! && id < best)) {
      best = id;
    }
  }
  return best === null ? null : (byId.get(best) ?? null);
}

function toCandidate(
  key: string,
  rows: Seen[],
  recurrence: Recurrence,
  categories: Map<number, CategoryRow>,
): RecurringCandidate {
  const newest = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return {
    key,
    label: newest.description,
    category: commonCategory(rows, categories),
    recurrence,
    drift: amountDrift(rows),
    monthlyCents: monthlyCostCents(recurrence),
    suggestedPattern: suggestPattern(
      key,
      rows.map((r) => r.normalized),
    ),
    suggestedTolerancePct: suggestedTolerancePct(rows, recurrence.medianAmountCents),
  };
}

async function categoriesById(): Promise<Map<number, CategoryRow>> {
  const ds = await getDataSource();
  return new Map((await ds.getRepository(CategoryEntity).find()).map((c) => [c.id, c]));
}

/**
 * Repeating charges that are not already a frais fixe and have not been waved
 * away, dearest first.
 *
 * A charge already declared is not a suggestion, so every active frais fixe
 * pattern is compiled and tried against each group. That check is the reason
 * confirming a suggestion needs no bookkeeping: the moment the frais fixe
 * exists, the suggestion stops being one.
 */
export async function listRecurringCharges(
  months = DEFAULT_MONTHS,
  now: Date = new Date(),
): Promise<RecurringCandidate[]> {
  const ds = await getDataSource();
  const rows = await ledger(months, now, "out");
  if (rows.length === 0) return [];

  const fxQb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .where("f.is_active = true");
  applyOwnedScope(fxQb, "f", await getScope());
  const declared = (await fxQb.getMany())
    .map((f) =>
      compileRule({
        id: 0,
        categoryId: 0,
        pattern: f.matchPattern,
        matchType: f.matchType,
        amountCondition: "negative",
        priority: 0,
      }),
    )
    .filter((r) => r !== null);

  const dismissed = new Set(
    (await ds.getRepository(RecurringDismissalEntity).find()).map((d) => d.key),
  );

  const categories = await categoriesById();
  const candidates: RecurringCandidate[] = [];

  for (const [key, group] of groupByKey(rows)) {
    if (dismissed.has(key)) continue;
    const recurrence = detectRecurrence(group);
    if (!recurrence) continue;
    if (group.some((row) => declared.some((rule) => rule.test(row.normalized, row.amountCents)))) {
      continue;
    }
    candidates.push(toCandidate(key, group, recurrence, categories));
  }

  return candidates.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

/**
 * Money that arrives on a schedule: a salary, a pension, a rent collected.
 *
 * Not shown as a suggestion anywhere. This is what lets a projection know the
 * salary lands on the 28th, without which every forecast made before payday
 * says the household is about to run dry.
 */
export async function listRecurringIncome(
  months = DEFAULT_MONTHS,
  now: Date = new Date(),
): Promise<RecurringCandidate[]> {
  const rows = await ledger(months, now, "in");
  if (rows.length === 0) return [];

  const categories = await categoriesById();
  const candidates: RecurringCandidate[] = [];
  for (const [key, group] of groupByKey(rows)) {
    const recurrence = detectRecurrence(group);
    if (recurrence) candidates.push(toCandidate(key, group, recurrence, categories));
  }
  return candidates.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

/** Suggestions turned down, so the page can offer to bring them back. */
export async function listDismissedKeys(): Promise<string[]> {
  const ds = await getDataSource();
  return (await ds.getRepository(RecurringDismissalEntity).find({ order: { key: "ASC" } })).map(
    (d) => d.key,
  );
}
