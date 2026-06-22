import "reflect-metadata";
import { type DataSource, IsNull } from "typeorm";
import { getDataSource } from "./client";
import {
  AccountEntity,
  CategoryEntity,
  ContributionEntity,
  FixedExpenseEntity,
  RuleEntity,
  SettingEntity,
  UserEntity,
} from "./entities";
import { loadCorePacks } from "../categorize/packs/loader";

const DEFAULT_CATEGORY_COLOR = "#94a3b8";
const DEFAULT_CATEGORY_ICON = "HelpCircle";

export async function runSeed(ds: DataSource): Promise<{
  createdCategories: number;
  createdRules: number;
}> {
  const catRepo = ds.getRepository(CategoryEntity);
  const ruleRepo = ds.getRepository(RuleEntity);
  const accountRepo = ds.getRepository(AccountEntity);

  let createdCats = 0;
  let createdRules = 0;

  // Default categories + rules come from the open-source core packs
  // (lib/categorize/packs/core/*.yaml). Extra packs (PATTERN_PACKS) are a
  // runtime overlay and are NOT seeded.
  const seedCategories = loadCorePacks().flatMap((pack) => pack.categories);

  for (const cat of seedCategories) {
    let category = await catRepo.findOne({ where: { name: cat.name } });
    if (!category) {
      category = await catRepo.save(
        catRepo.create({
          name: cat.name,
          color: cat.color ?? DEFAULT_CATEGORY_COLOR,
          icon: cat.icon ?? DEFAULT_CATEGORY_ICON,
          isDefault: true,
        }),
      );
      createdCats++;
    }

    for (const rule of cat.rules) {
      const exists = await ruleRepo.findOne({ where: { pattern: rule.pattern } });
      if (!exists) {
        await ruleRepo.save(
          ruleRepo.create({
            categoryId: category.id,
            pattern: rule.pattern,
            matchType: rule.matchType ?? "contains",
            amountCondition: rule.amountCondition ?? "any",
            priority: rule.priority ?? 100,
            isActive: true,
          }),
        );
        createdRules++;
      }
    }
  }

  // Default account so the user can ingest immediately
  if ((await accountRepo.count()) === 0) {
    await accountRepo.save(accountRepo.create({ name: "Compte courant", bank: null }));
  }

  await backfillOwnership(ds);

  return { createdCategories: createdCats, createdRules };
}

/**
 * Auth/ownership foundation. Idempotent; safe to re-run. Keeps existing
 * single-user data working with everything shared and no login.
 */
export async function backfillOwnership(ds: DataSource): Promise<void> {
  const userRepo = ds.getRepository(UserEntity);
  const settingRepo = ds.getRepository(SettingEntity);

  // 1. Ensure a single owner user (open mode ⇒ no password).
  let owner = await userRepo.findOne({ where: { role: "owner" } });
  if (!owner) {
    owner = await userRepo.save(userRepo.create({ name: "Propriétaire", role: "owner" }));
  }
  const ownerId = owner.id;

  // 2. Default auth mode = open (preserves the no-login behaviour).
  const authMode = await settingRepo.findOne({ where: { key: "authMode" } });
  if (!authMode) {
    await settingRepo.save(settingRepo.create({ key: "authMode", value: "open" }));
  }

  // 3. Attribute existing ownable rows to the owner (visibility already
  //    defaults to 'shared'). Only fills NULL owner_id, so re-runs are no-ops.
  await ds.getRepository(AccountEntity).update({ ownerId: IsNull() }, { ownerId });
  await ds.getRepository(RuleEntity).update({ ownerId: IsNull() }, { ownerId });
  await ds.getRepository(ContributionEntity).update({ ownerId: IsNull() }, { ownerId });
  await ds.getRepository(FixedExpenseEntity).update({ ownerId: IsNull() }, { ownerId });
}

async function main() {
  const ds = await getDataSource(); // synchronize:true creates/updates the schema
  console.log("Schema synchronized. Seeding categories and rules...");
  const result = await runSeed(ds);
  console.log(
    `Seed done. New categories: ${result.createdCategories}, new rules: ${result.createdRules}`,
  );
  await ds.destroy();
}

// Only run as CLI when invoked directly
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("seed.ts");
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
