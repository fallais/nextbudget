import "server-only";
import { IsNull } from "typeorm";
import {
  categories,
  contributions,
  merchantOverrides,
  rules,
  transactions,
} from "@infrastructure/persistence/repositories";
import type { TransactionRepository } from "@domain/repositories";
import { MERCHANT_CATALOG } from "@infrastructure/categorize/catalog";
import {
  compileRule,
  compileContributionsAsRules,
  matchCategoryId,
  orderRules,
  type CompiledRule,
} from "@domain/services/categorization";
import {
  compileMerchants,
  resolveMerchants,
  type MerchantOverrideInput,
  type ResolvedMerchant,
} from "@domain/services/merchant-catalog";
export { compileRule, matchCategoryId, type CompiledRule } from "@domain/services/categorization";

/**
 * Everything that decides a category, in the order it is tried.
 *
 * Three layers meet here and only here:
 *
 *  1. **Your rules** — the `rules` table, written on the Catégories page.
 *  2. **Synthetic rules** — contributions, at priority 40, so an apport from a
 *     housemate labelled "DE JEAN - EDF" is an apport and not an energy bill.
 *  3. **The shipped catalogue** — `@infrastructure/categorize/catalog`,
 *     evaluated at runtime with your overrides applied.
 *
 * The catalogue used to be a YAML file copied into the `rules` table at
 * migrate time. That made every shipped merchant a row you owned, so an
 * improved catalogue could never reach an install that had already seeded, and
 * a list of two hundred patterns you never wrote buried the handful you did.
 * It now stays code; the database holds what *you* decided — your rules, and
 * your overrides on ours.
 */
export async function loadActiveCompiledRules(): Promise<CompiledRule[]> {
  const [allRules, allCategories, overrideRows, allContribs] = await Promise.all([
    rules.findAll(),
    categories.findAll(),
    merchantOverrides.findAll(),
    contributions.findAll(),
  ]);

  // Filtered here rather than in SQL: both sets are small, and the final
  // ordering is `orderRules`, so what comes back in what order does not matter.
  const ruleRows = allRules.map((r) => r.toRow()).filter((r) => r.isActive);
  const categoryRows = allCategories.map((c) => c.toRow());
  const activeContribs = allContribs.map((c) => c.toRow()).filter((c) => c.isActive);

  const userRules = ruleRows
    .map((r) => compileRule(r))
    .filter((r): r is CompiledRule => r !== null);

  const idByName = new Map(categoryRows.map((c) => [c.name, c.id]));
  const catalogRules = compileMerchants(
    resolveMerchants(
      MERCHANT_CATALOG,
      (name) => idByName.get(name) ?? null,
      overrideRows.map((o) => o.toRow() as MerchantOverrideInput),
    ),
  );

  // Any positive transaction matching an active contribution pattern is an
  // apport; that has to outrank the merchant it was paid to.
  const apports = categoryRows.find((c) => c.name === "Apports");
  const contribRules = apports ? compileContributionsAsRules(apports.id, activeContribs) : [];

  return orderRules([...contribRules, ...userRules, ...catalogRules]);
}

/** The catalogue as it stands for this install — what the Marchands screen shows. */
export async function resolveCatalog(): Promise<ResolvedMerchant[]> {
  const [allCategories, overrideRows] = await Promise.all([
    categories.findAll(),
    merchantOverrides.findAll(),
  ]);
  const idByName = new Map(allCategories.map((c) => [c.toRow().name, c.toRow().id]));
  return resolveMerchants(
    MERCHANT_CATALOG,
    (name) => idByName.get(name) ?? null,
    overrideRows.map((o) => o.toRow() as MerchantOverrideInput),
  );
}

export type RecategorizeResult = {
  scanned: number;
  updated: number;
  cleared: number;
};

export type RecategorizeDeps = {
  transactions: Pick<TransactionRepository, "findForCategorization" | "setCategory">;
};

const LIVE_RECATEGORIZE: RecategorizeDeps = { transactions };

export async function recategorizeAll(
  options?: { onlyUncategorized?: boolean },
  deps: RecategorizeDeps = LIVE_RECATEGORIZE,
): Promise<RecategorizeResult> {
  const compiled = await loadActiveCompiledRules();
  const rows = await deps.transactions.findForCategorization(!!options?.onlyUncategorized);

  let updated = 0;
  let cleared = 0;
  for (const tx of rows) {
    const next = matchCategoryId(tx.normalizedDescription, tx.amountCents, compiled);
    if (next !== tx.categoryId) {
      if (next === null) cleared++;
      else updated++;
      await deps.transactions.setCategory(tx.id, next);
    }
  }
  return { scanned: rows.length, updated, cleared };
}
