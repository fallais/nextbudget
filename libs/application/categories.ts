import "server-only";
import {
  budgets,
  categories,
  fixedExpenses,
  merchantOverrides,
  rules,
  transactions,
} from "@infrastructure/persistence/repositories";

import type { z } from "zod";
import type { categoryInputSchema } from "./contracts/validation";
import type { Repository } from "@domain/repositories";
import type { Category, CategoryRow, NewCategory } from "@domain/entities";

/**
 * Everything the app does to a category.
 *
 * Including the one-liners. A use case per operation is not ceremony here: it
 * is what stops the decision of the moment — `isDefault: false`, who owns the
 * row — from being made in a route handler where nothing can reach it.
 */

type CategoryRepo = Repository<Category, CategoryRow, NewCategory>;

export type CategoryDeps = {
  categories: Pick<CategoryRepo, "findAll" | "findById" | "create" | "update" | "delete">;
  rules: Pick<typeof rules, "deleteByCategory">;
  budgets: Pick<typeof budgets, "deleteByCategory">;
  transactions: Pick<typeof transactions, "clearCategory">;
  fixedExpenses: Pick<typeof fixedExpenses, "clearCategory">;
};

const LIVE: CategoryDeps = { categories, rules, budgets, transactions, fixedExpenses };

export type CategoryInput = z.infer<typeof categoryInputSchema>;
/** What a PATCH may carry: any subset, and never a default filled in for you. */
export type CategoryPatch = Partial<CategoryInput>;

export async function listCategories(deps: CategoryDeps = LIVE): Promise<CategoryRow[]> {
  return (await deps.categories.findAll()).map((c) => c.toRow());
}

/**
 * A category the user made.
 *
 * `isDefault` is not theirs to set: it marks the ones `db:migrate` seeds and
 * is what stops them being deleted out from under a fresh install.
 */
/** Resolves `null` when no category has that id. */
export async function findCategory(
  categoryId: number,
  deps: CategoryDeps = LIVE,
): Promise<CategoryRow | null> {
  const found = await deps.categories.findById(categoryId);
  return found?.toRow() ?? null;
}

export async function createCategory(
  input: CategoryInput,
  deps: CategoryDeps = LIVE,
): Promise<CategoryRow> {
  const created = await deps.categories.create({ ...input, isDefault: false });
  return created.toRow();
}

/** Resolves `null` when no category has that id. */
export async function updateCategory(
  categoryId: number,
  patch: CategoryPatch,
  deps: CategoryDeps = LIVE,
): Promise<CategoryRow | null> {
  const updated = await deps.categories.update(categoryId, patch);
  return updated?.toRow() ?? null;
}

/**
 * Delete a category and everything that pointed at it.
 *
 * This is the `ON DELETE` behaviour the schema does not express: rules and
 * budgets cascade, because a rule filing into a category that no longer exists
 * (or a budget for it) is meaningless; a merchant override pointing here falls
 * back to the catalogue. Transactions and fixed expenses only
 * lose the link — the spending still happened and the bill is still due, they
 * just become uncategorised.
 *
 * Order matters: dependents go first, so a failure part-way leaves the category
 * present and re-runnable rather than deleted with dangling children.
 *
 * Resolves `false` when no such category exists.
 */
export async function deleteCategory(
  categoryId: number,
  deps: CategoryDeps = LIVE,
): Promise<boolean> {
  const category = await deps.categories.findById(categoryId);
  if (!category) return false;

  await deps.rules.deleteByCategory(categoryId);
  await deps.budgets.deleteByCategory(categoryId);
  await deps.transactions.clearCategory(categoryId);
  await deps.fixedExpenses.clearCategory(categoryId);

  return deps.categories.delete(categoryId);
}
