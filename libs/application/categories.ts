import "server-only";
import {
  budgets,
  categories,
  fixedExpenses,
  rules,
  transactions,
} from "@infrastructure/persistence/repositories";
import type { BudgetPeriod } from "@domain/enums";

/**
 * Category use cases that are more than a single repository call.
 */

/**
 * Delete a category and everything that pointed at it.
 *
 * This is the `ON DELETE` behaviour the schema does not express: rules and
 * budgets cascade, because a rule filing into a category that no longer exists
 * (or a budget for it) is meaningless. Transactions and fixed expenses only
 * lose the link — the spending still happened and the bill is still due, they
 * just become uncategorised.
 *
 * Order matters: dependents go first, so a failure part-way leaves the category
 * present and re-runnable rather than deleted with dangling children.
 *
 * Resolves `false` when no such category exists.
 */
export async function deleteCategory(categoryId: number): Promise<boolean> {
  const category = await categories.findById(categoryId);
  if (!category) return false;

  await rules.deleteByCategory(categoryId);
  await budgets.deleteByCategory(categoryId);
  await transactions.clearCategory(categoryId);
  await fixedExpenses.clearCategory(categoryId);

  return categories.delete(categoryId);
}

/**
 * Set (or clear) the budget attached to a category.
 *
 * v0.1 keeps it to one budget per category, so this replaces rather than
 * accumulates: the existing row goes, and a new one is written only when both
 * an amount and a period were supplied. Passing either as `null` clears it.
 */
export async function setCategoryBudget(
  categoryId: number,
  amountCents: number | null,
  period: BudgetPeriod | null,
  ownerId: number | null,
): Promise<void> {
  await budgets.deleteByCategory(categoryId);
  if (amountCents === null || period === null) return;

  await budgets.create({
    categoryId,
    amountCents,
    period,
    ownerId,
    visibility: "shared",
  });
}
