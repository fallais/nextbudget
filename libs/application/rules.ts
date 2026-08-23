import "server-only";
import { rules, transactions } from "@infrastructure/persistence/repositories";
import { compileRule } from "@domain/services/categorization";
import { getCurrentUser } from "./auth";
import type { Rule, RuleRow, NewRule, TransactionRow } from "@domain/entities";
import type { RuleRepository, TransactionRepository } from "@domain/repositories";
import type { z } from "zod";
import type { ruleInputSchema } from "./contracts/validation";

/**
 * Everything the app does to a categorisation rule.
 */

export type RuleDeps = {
  transactions: Pick<TransactionRepository, "findAll">;
  rules: Pick<RuleRepository, "findAll" | "create" | "update" | "delete">;
  currentUserId: () => Promise<number | null>;
};

const LIVE: RuleDeps = {
  rules,
  transactions,
  currentUserId: async () => (await getCurrentUser())?.id ?? null,
};

export type RuleInput = z.infer<typeof ruleInputSchema>;

export async function listRules(deps: RuleDeps = LIVE): Promise<RuleRow[]> {
  return (await deps.rules.findAll()).map((r) => r.toRow());
}

/**
 * A rule the user wrote.
 *
 * Always shared, never private: rules are configuration for how the app reads
 * a statement, and the scope helpers deliberately never filter them. A private
 * rule would categorise one person's view of a joint account and not another's.
 */
export async function createRule(input: RuleInput, deps: RuleDeps = LIVE): Promise<RuleRow> {
  const created = await deps.rules.create({
    ...input,
    ownerId: await deps.currentUserId(),
    visibility: "shared",
  });
  return created.toRow();
}

/** Resolves `null` when no rule has that id. */
export async function updateRule(
  ruleId: number,
  patch: Partial<RuleInput>,
  deps: RuleDeps = LIVE,
): Promise<RuleRow | null> {
  const updated = await deps.rules.update(ruleId, patch);
  return updated?.toRow() ?? null;
}

/** Resolves `false` when there was nothing to delete. */
export async function deleteRule(ruleId: number, deps: RuleDeps = LIVE): Promise<boolean> {
  return deps.rules.delete(ruleId);
}


export type RuleTrial = {
  matchCount: number;
  total: number;
  samples: Pick<TransactionRow, "id" | "date" | "description" | "amountCents">[];
};

/**
 * Try a pattern against what is already imported, without saving it.
 *
 * The point is to answer "would this catch what I think it catches" before the
 * rule exists, so nothing is written and the compiled rule is thrown away.
 * Resolves `null` when the pattern will not compile — an unbalanced regex,
 * usually, which is the user's typo rather than a failure.
 */
export async function tryRule(
  draft: Pick<RuleInput, "pattern" | "matchType" | "amountCondition">,
  deps: RuleDeps = LIVE,
): Promise<RuleTrial | null> {
  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: draft.pattern,
    matchType: draft.matchType,
    amountCondition: draft.amountCondition,
    priority: 0,
  });
  if (!compiled) return null;

  const all = (await deps.transactions.findAll()).map((t) => t.toRow());
  const matches = all.filter((t) => compiled.test(t.normalizedDescription, t.amountCents));
  return {
    matchCount: matches.length,
    total: all.length,
    samples: matches.slice(0, 5).map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amountCents: t.amountCents,
    })),
  };
}

export type { Rule, NewRule };
