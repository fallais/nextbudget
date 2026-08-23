import { describe, it, expect } from "vitest";
import { deleteCategory, type CategoryDeps } from "./categories";
import { Category, type CategoryRow } from "@domain/entities";

/**
 * Deleting a category, and the cascade the schema does not express.
 *
 * There are no FK constraints, so `ON DELETE` behaviour lives in this use
 * case: rules and budgets go with the category, because a rule filing into
 * one that no longer exists is meaningless; transactions and fixed expenses
 * only lose the link, because the spending still happened and the bill is
 * still due.
 */

const stored: CategoryRow = {
  id: 5,
  name: "Courses",
  color: "#16a34a",
  icon: "ShoppingCart",
  isDefault: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function deps(found: CategoryRow | null, log: string[]): CategoryDeps {
  return {
    categories: {
      findAll: async () => [],
      findById: async () => (found ? Category.reconstitute(found) : null),
      create: async () => Category.reconstitute(stored),
      update: async () => Category.reconstitute(stored),
      delete: async () => {
        log.push("category");
        return true;
      },
    },
    rules: { deleteByCategory: async () => void log.push("rules") },
    budgets: { deleteByCategory: async () => void log.push("budgets") },
    transactions: { clearCategory: async () => void log.push("transactions") },
    fixedExpenses: { clearCategory: async () => void log.push("fixedExpenses") },
  } as unknown as CategoryDeps;
}

describe("deleteCategory", () => {
  it("takes its rules and budgets with it, and unlinks the rest", async () => {
    const log: string[] = [];
    expect(await deleteCategory(5, deps(stored, log))).toBe(true);
    expect(log).toEqual(["rules", "budgets", "transactions", "fixedExpenses", "category"]);
  });

  it("removes the dependents before the category itself", async () => {
    // Order matters: failing part way must leave the category present and the
    // whole thing re-runnable, not deleted with dangling children.
    const log: string[] = [];
    await deleteCategory(5, deps(stored, log));
    expect(log.indexOf("category")).toBe(log.length - 1);
  });

  it("touches nothing at all when the category does not exist", async () => {
    const log: string[] = [];
    expect(await deleteCategory(404, deps(null, log))).toBe(false);
    expect(log).toEqual([]);
  });
});
