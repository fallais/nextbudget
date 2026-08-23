import "server-only";
import { fixedExpenses } from "@infrastructure/persistence/repositories";
import { getCurrentUser } from "./auth";
import type { FixedExpense, FixedExpenseRow, NewFixedExpense } from "@domain/entities";
import type { FixedExpenseRepository } from "@domain/repositories";
import type { z } from "zod";
import type { fixedExpenseInputSchema } from "./contracts/validation";

/**
 * Charges fixes: the writes, plus the read models re-exported.
 */
export * from "@infrastructure/persistence/queries/fixed-expenses";

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
    cadence: input.cadence,
    dueDay: input.dueDay,
    dueMonth: input.dueMonth ?? null,
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
