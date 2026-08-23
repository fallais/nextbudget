import "server-only";
import { budgets } from "@infrastructure/persistence/repositories";
import type { BudgetRepository } from "@domain/repositories";
import type { BudgetRow, NewBudget } from "@domain/entities";
import type { BudgetPeriod } from "@domain/enums";
import { invariant } from "@domain/errors";

/**
 * Budgets: the writes, plus the read models re-exported.
 *
 * `app/` imports this and never the query layer, so where the figures come
 * from stays an infrastructure decision.
 */
export * from "@infrastructure/persistence/queries/budgets";

/**
 * A budget is one per category.
 *
 * The unique index alone would not say so — it allows the same category a
 * weekly *and* a monthly ceiling, which would silently double-count the same
 * spending. The rule is stated here, where creating one is the only way in.
 */
export async function createBudget(input: {
  categoryId: number;
  amountCents: number;
  period: BudgetPeriod;
  ownerId: number | null;
}): Promise<BudgetRow> {
  const existing = await budgets.findByCategory(input.categoryId);
  invariant(
    existing === null,
    "Cette catégorie a déjà un budget.",
    "budget.duplicate_category",
  );

  const created = await budgets.create({
    categoryId: input.categoryId,
    amountCents: input.amountCents,
    period: input.period,
    ownerId: input.ownerId,
    visibility: "shared",
  });
  return created.toRow();
}


export type BudgetDeps = {
  budgets: Pick<BudgetRepository, "update" | "delete">;
};

const LIVE_BUDGET: BudgetDeps = { budgets };

/** Resolves `null` when no budget has that id. */
export async function updateBudget(
  budgetId: number,
  patch: Partial<NewBudget>,
  deps: BudgetDeps = LIVE_BUDGET,
): Promise<BudgetRow | null> {
  const updated = await deps.budgets.update(budgetId, patch);
  return updated?.toRow() ?? null;
}

/** Resolves `false` when there was nothing to delete. */
export async function deleteBudget(
  budgetId: number,
  deps: BudgetDeps = LIVE_BUDGET,
): Promise<boolean> {
  return deps.budgets.delete(budgetId);
}
