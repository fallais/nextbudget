import { IsNull } from "typeorm";
import { getDataSource } from "@/lib/db/client";
import {
  RuleEntity,
  TransactionEntity,
  CategoryEntity,
  ContributionEntity,
} from "@/lib/db/entities";
import {
  compileRule,
  compileContributionsAsRules,
  matchCategoryId,
  type CompiledRule,
} from "./core";
import { loadRuntimePacks, compilePackRules } from "./packs/loader";

export { compileRule, matchCategoryId, type CompiledRule } from "./core";

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

  let dbLayer: CompiledRule[];
  if (!apports) {
    dbLayer = regular;
  } else {
    const activeContribs = await ds
      .getRepository(ContributionEntity)
      .find({ where: { isActive: true } });
    const contribRules = compileContributionsAsRules(apports.id, activeContribs);
    dbLayer = [...contribRules, ...regular].sort((a, b) => a.priority - b.priority);
  }

  // Runtime overlay packs (PATTERN_PACKS): personal/local + SaaS "premium".
  // Applied strictly BELOW the DB rules as a pure fallback — user/DB rules win.
  const runtimePacks = loadRuntimePacks();
  if (runtimePacks.length === 0) return dbLayer;
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));
  const overlay = compilePackRules(runtimePacks, categoryIdByName).sort(
    (a, b) => a.priority - b.priority,
  );
  return [...dbLayer, ...overlay];
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
