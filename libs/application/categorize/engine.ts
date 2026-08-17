import { IsNull } from "typeorm";
import { getDataSource } from "@infrastructure/db/client";
import { RuleEntity, TransactionEntity, CategoryEntity, ContributionEntity } from "@infrastructure/db/schemas";
import {
  compileRule,
  compileContributionsAsRules,
  matchCategoryId,
  type CompiledRule,
} from "@domain/services/categorization";
export { compileRule, matchCategoryId, type CompiledRule } from "@domain/services/categorization";

/**
 * The active rule set: everything in the `rules` table, plus synthetic rules
 * derived from contributions. Defaults from `categories.yaml` are seeded into
 * that table at migrate time, so there is no separate layer to consult here —
 * what the Rules page shows is what runs.
 */
export async function loadActiveCompiledRules(): Promise<CompiledRule[]> {
  const ds = await getDataSource();
  const all = await ds
    .getRepository(RuleEntity)
    .find({ where: { isActive: true }, order: { priority: "ASC" } });
  const regular = all.map(compileRule).filter((r): r is CompiledRule => r !== null);

  // Inject synthetic high-priority rules: any positive transaction matching an
  // active contribution pattern is an Apport (overrides generic merchant rules).
  const categories = await ds.getRepository(CategoryEntity).find();
  const apports = categories.find((c) => c.name === "Apports");

  if (!apports) return regular;

  const activeContribs = await ds
    .getRepository(ContributionEntity)
    .find({ where: { isActive: true } });
  const contribRules = compileContributionsAsRules(apports.id, activeContribs);
  return [...contribRules, ...regular].sort((a, b) => a.priority - b.priority);
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
