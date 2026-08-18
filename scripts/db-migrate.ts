import "reflect-metadata";
import { type DataSource, IsNull } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { AccountEntity, CategoryEntity, ContributionEntity, FixedExpenseEntity, PersonEntity, RuleEntity, SettingEntity, UserEntity } from "@infrastructure/persistence/schemas";
import { loadDefaultCategories } from "@infrastructure/categorize/defaults";

/**
 * `npm run db:migrate` — bring a database up to date, then seed defaults.
 *
 * There are no migration files: `synchronize: true` derives the schema from
 * `@infrastructure/persistence/schemas`, so connecting is the migration. Everything
 * after that is additive seeding, which is why this is safe to re-run.
 *
 * A standalone `tsx` entrypoint like `auth-reset.ts`, so it does not read
 * `.env.local` (Next loads that, not node) — pass `DATABASE_URL=… npm run …`.
 */

const DEFAULT_CATEGORY_COLOR = "#94a3b8";
const DEFAULT_CATEGORY_ICON = "HelpCircle";

async function runSeed(ds: DataSource): Promise<{
  createdCategories: number;
  createdRules: number;
}> {
  const catRepo = ds.getRepository(CategoryEntity);
  const ruleRepo = ds.getRepository(RuleEntity);
  const accountRepo = ds.getRepository(AccountEntity);

  let createdCats = 0;
  let createdRules = 0;

  // Defaults live in libs/infrastructure/categorize/categories.yaml. Seeding is additive: it
  // only creates what is missing, so edits made on the Rules page survive a
  // re-run and the DB stays the single source of truth for the engine.
  for (const cat of loadDefaultCategories()) {
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

    for (const rule of cat.patterns) {
      const exists = await ruleRepo.findOne({ where: { pattern: rule.pattern } });
      if (!exists) {
        await ruleRepo.save(
          ruleRepo.create({
            categoryId: category.id,
            pattern: rule.pattern,
            matchType: rule.matchType,
            amountCondition: rule.amountCondition,
            priority: rule.priority,
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
async function backfillOwnership(ds: DataSource): Promise<void> {
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

  // 3. Ensure the owner exists as a household member too. Ownership shares and
  //    contributions are attributed to persons, not users, so a brand-new solo
  //    install needs one before it can record who owns what.
  const personRepo = ds.getRepository(PersonEntity);
  const ownerPerson = await personRepo.findOne({ where: { userId: ownerId } });
  if (!ownerPerson) {
    // An install that predates the link may already have a person standing in
    // for the owner; adopt the first unlinked one rather than duplicating them.
    const orphan = await personRepo.findOne({
      where: { userId: IsNull() },
      order: { id: "ASC" },
    });
    if (orphan) {
      await personRepo.update(orphan.id, { userId: ownerId });
    } else {
      await personRepo.save(personRepo.create({ name: owner.name, userId: ownerId }));
    }
  }

  // 4. Attribute existing ownable rows to the owner (visibility already
  //    defaults to 'shared'). Only fills NULL owner_id, so re-runs are no-ops.
  await ds.getRepository(AccountEntity).update({ ownerId: IsNull() }, { ownerId });
  // Accounts predating the personal/joint distinction are personal: an install
  // cannot know which one is the common pot, and guessing wrong would silently
  // change what the Apports page matches against.
  await ds.getRepository(AccountEntity).update({ kind: IsNull() }, { kind: "personal" });
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
