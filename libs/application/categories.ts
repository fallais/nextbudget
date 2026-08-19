import "server-only";
import {
  budgets,
  categories,
  fixedExpenses,
  rules,
  transactions,
} from "@infrastructure/persistence/repositories";

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
