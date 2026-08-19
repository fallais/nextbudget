import type { Budget, BudgetRow, NewBudget } from "@domain/entities";
import type { FixedExpense, FixedExpenseRow, NewFixedExpense } from "@domain/entities";
import type { Rule, RuleRow, NewRule } from "@domain/entities";
import type { Repository } from "./repository";

/**
 * What deleting a category has to reach.
 *
 * With no FK constraints in the schema, the old `ON DELETE` behaviour is app
 * code: rules and budgets cascade (a budget for a category that no longer
 * exists is meaningless), fixed expenses merely lose the link (the expense is
 * still real and still due).
 */

export interface RuleRepository extends Repository<Rule, RuleRow, NewRule> {
  deleteByCategory(categoryId: number): Promise<void>;
}

export interface BudgetRepository extends Repository<Budget, BudgetRow, NewBudget> {
  deleteByCategory(categoryId: number): Promise<void>;
  /** A category holds at most one budget; this is what enforces it on create. */
  findByCategory(categoryId: number): Promise<Budget | null>;
}

export interface FixedExpenseRepository
  extends Repository<FixedExpense, FixedExpenseRow, NewFixedExpense> {
  clearCategory(categoryId: number): Promise<void>;
}
