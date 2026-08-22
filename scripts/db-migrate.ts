import "reflect-metadata";
import { type DataSource, IsNull } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { AccountEntity, CategoryEntity, ContributionEntity, FixedExpenseEntity, PersonEntity, RuleEntity, SettingEntity, UserEntity } from "@infrastructure/persistence/schemas";
import { DEFAULT_CATEGORIES } from "@infrastructure/categorize/default-categories";
import { MERCHANT_CATALOG } from "@infrastructure/categorize/catalog";
import { hashPassword } from "@infrastructure/auth/password";
import type { UserRow } from "@domain/entities";
import { MERCHANT_KIND_CATEGORY } from "@domain/enums";
import { normalizeDescription } from "@domain/value-objects/normalized-description";

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
  prunedRules: number;
}> {
  const catRepo = ds.getRepository(CategoryEntity);
  const accountRepo = ds.getRepository(AccountEntity);

  let createdCats = 0;

  // Only categories are seeded now. Merchant patterns live in TypeScript
  // (libs/infrastructure/categorize/catalog) and are evaluated at runtime, so
  // there is nothing to copy into the rules table — and an improved catalogue
  // reaches an install that seeded months ago.
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await catRepo.findOne({ where: { name: cat.name } });
    if (existing) continue;
    await catRepo.save(
      catRepo.create({
        name: cat.name,
        color: cat.color ?? DEFAULT_CATEGORY_COLOR,
        icon: cat.icon ?? DEFAULT_CATEGORY_ICON,
        isDefault: true,
      }),
    );
    createdCats++;
  }

  const prunedRules = await pruneSeededRules(ds);

  // Default account so the user can ingest immediately
  if ((await accountRepo.count()) === 0) {
    await accountRepo.save(accountRepo.create({ name: "Compte courant", bank: null }));
  }

  await backfillOwnership(ds);

  return { createdCategories: createdCats, prunedRules };
}

/**
 * Drop the rules an older version seeded from `categories.yaml`.
 *
 * Only the ones still identical to what the catalogue now says: same pattern,
 * same target category, plain `contains`, default priority, no amount
 * condition. Those are pure duplicates of a catalogue entry — deleting them
 * changes no categorisation and hands the Catégories page back to the rules
 * you actually wrote. Anything you touched differs, and is kept: an edited
 * rule still outranks the catalogue.
 */
async function pruneSeededRules(ds: DataSource): Promise<number> {
  const ruleRepo = ds.getRepository(RuleEntity);
  const catRepo = ds.getRepository(CategoryEntity);

  const catalogPatterns = new Map<string, string>();
  for (const entry of MERCHANT_CATALOG) {
    for (const pattern of entry.patterns) {
      catalogPatterns.set(normalizeDescription(pattern), MERCHANT_KIND_CATEGORY[entry.kind]);
    }
  }

  const categories = await catRepo.find();
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  let pruned = 0;
  for (const rule of await ruleRepo.find()) {
    if (rule.matchType !== "contains" || rule.amountCondition !== "any") continue;
    if (rule.priority !== 100 || !rule.isActive) continue;
    const target = catalogPatterns.get(normalizeDescription(rule.pattern));
    if (!target || target !== nameById.get(rule.categoryId)) continue;
    await ruleRepo.delete(rule.id);
    pruned++;
  }
  return pruned;
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
    const named = process.env.NEXTBUDGET_OWNER_NAME?.trim();
    owner = await userRepo.save(userRepo.create({ name: named || "Propriétaire", role: "owner" }));
  }
  const ownerId = owner.id;

  // 2. Default auth mode = open (preserves the no-login behaviour)...
  const authMode = await settingRepo.findOne({ where: { key: "authMode" } });
  if (!authMode) {
    await settingRepo.save(settingRepo.create({ key: "authMode", value: "open" }));
  }

  // ...unless the deployment shipped the owner a login. Before step 3, so the
  // household member created below carries the name the login ended up with.
  await applyOwnerEnv(ds, owner);

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

/**
 * Give the owner a login from the environment, on an install that has none.
 *
 * A fresh install answers with no login at all (`authMode: open`, owner with
 * no password) — right for a laptop, wrong for a box on the LAN. These three
 * variables let a deployment come up already secured, instead of someone
 * having to reach the UI first to enable auth:
 *
 *   NEXTBUDGET_OWNER_NAME      display name, and one of the login identifiers
 *   NEXTBUDGET_OWNER_EMAIL     the other identifier (optional)
 *   NEXTBUDGET_OWNER_PASSWORD  ≥ 8 characters; setting it switches auth to `enforced`
 *
 * Read **only while the owner has no password** — the state of an install
 * nobody has secured yet. Once a password exists, whether it was set here, in
 * the UI or by `auth:reset`, these are ignored: a value left behind in a
 * compose file must not silently revert a password changed since, and
 * re-running `db:migrate` after an upgrade has to stay a no-op. Changing it
 * later is `npm run auth:reset -- <password>`.
 */
async function applyOwnerEnv(ds: DataSource, owner: UserRow): Promise<void> {
  const name = process.env.NEXTBUDGET_OWNER_NAME?.trim();
  const email = process.env.NEXTBUDGET_OWNER_EMAIL?.trim();
  const password = process.env.NEXTBUDGET_OWNER_PASSWORD;
  if (!name && !email && !password) return;

  if (owner.passwordHash) {
    console.log(
      "NEXTBUDGET_OWNER_* ignored: this install already has a password. " +
        "Change it with `npm run auth:reset -- <password>`.",
    );
    return;
  }
  if (password !== undefined && password.length < 8) {
    throw new Error("NEXTBUDGET_OWNER_PASSWORD must be at least 8 characters.");
  }

  const userRepo = ds.getRepository(UserEntity);
  const patch: Partial<UserRow> = {};
  if (name && name !== owner.name) patch.name = name;
  if (email && email !== owner.email) {
    // users.email is unique: fail loudly rather than let TypeORM raise 23505
    // halfway through a migration.
    const taken = await userRepo.findOne({ where: { email } });
    if (taken && taken.id !== owner.id) {
      throw new Error(`NEXTBUDGET_OWNER_EMAIL "${email}" already belongs to another user.`);
    }
    patch.email = email;
  }
  if (password) patch.passwordHash = await hashPassword(password);

  if (Object.keys(patch).length === 0) return;
  await userRepo.update(owner.id, patch);
  Object.assign(owner, patch); // step 3 names the household member after it

  if (password) {
    await ds.getRepository(SettingEntity).save({ key: "authMode", value: "enforced" });
    console.log(
      `Auth enforced. Log in as "${owner.name}"` +
        `${owner.email ? ` or "${owner.email}"` : ""} with NEXTBUDGET_OWNER_PASSWORD.`,
    );
  } else {
    console.log(`Owner identity set from the environment: "${owner.name}". Auth mode unchanged.`);
  }
}

async function main() {
  const ds = await getDataSource(); // synchronize:true creates/updates the schema
  console.log("Schema synchronized. Seeding categories and rules...");
  const result = await runSeed(ds);
  console.log(
    `Seed done. New categories: ${result.createdCategories}, ` +
      `redundant seeded rules removed: ${result.prunedRules}`,
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
