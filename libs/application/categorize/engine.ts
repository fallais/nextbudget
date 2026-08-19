import "server-only";
import { IsNull } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { merchantOverrides } from "@infrastructure/persistence/repositories";
import { RuleEntity, TransactionEntity, CategoryEntity, ContributionEntity } from "@infrastructure/persistence/schemas";
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
  const ds = await getDataSource();

  const [ruleRows, categories, overrideRows, activeContribs] = await Promise.all([
    ds.getRepository(RuleEntity).find({ where: { isActive: true }, order: { priority: "ASC" } }),
    ds.getRepository(CategoryEntity).find(),
    merchantOverrides.findAll(),
    ds.getRepository(ContributionEntity).find({ where: { isActive: true } }),
  ]);

  const userRules = ruleRows
    .map((r) => compileRule(r))
    .filter((r): r is CompiledRule => r !== null);

  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const catalogRules = compileMerchants(
    resolveMerchants(
      MERCHANT_CATALOG,
      (name) => idByName.get(name) ?? null,
      overrideRows.map((o) => o.toRow() as MerchantOverrideInput),
    ),
  );

  // Any positive transaction matching an active contribution pattern is an
  // apport; that has to outrank the merchant it was paid to.
  const apports = categories.find((c) => c.name === "Apports");
  const contribRules = apports ? compileContributionsAsRules(apports.id, activeContribs) : [];

  return orderRules([...contribRules, ...userRules, ...catalogRules]);
}

/** The catalogue as it stands for this install — what the Marchands screen shows. */
export async function resolveCatalog(): Promise<ResolvedMerchant[]> {
  const ds = await getDataSource();
  const [categories, overrideRows] = await Promise.all([
    ds.getRepository(CategoryEntity).find(),
    merchantOverrides.findAll(),
  ]);
  const idByName = new Map(categories.map((c) => [c.name, c.id]));
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

export async function recategorizeAll(options?: {
  onlyUncategorized?: boolean;
}): Promise<RecategorizeResult> {
  const ds = await getDataSource();
  const compiled = await loadActiveCompiledRules();
  const txRepo = ds.getRepository(TransactionEntity);
  const rows = options?.onlyUncategorized
    ? await txRepo.find({ where: { categoryId: IsNull() } })
    : await txRepo.find();

  let updated = 0;
  let cleared = 0;
  for (const tx of rows) {
    const next = matchCategoryId(tx.normalizedDescription, tx.amountCents, compiled);
    if (next !== tx.categoryId) {
      if (next === null) cleared++;
      else updated++;
      await txRepo.update(tx.id, { categoryId: next });
    }
  }
  return { scanned: rows.length, updated, cleared };
}
