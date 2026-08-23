import "server-only";
import { IsNull } from "typeorm";
import {
  Account,
  Asset,
  Budget,
  Category,
  Contribution,
  FixedExpense,
  MerchantOverride,
  Person,
  Rule,
  Transaction,
  User,
  type AccountRow,
  type AssetRow,
  type BudgetRow,
  type CategoryRow,
  type ContributionRow,
  type FixedExpenseRow,
  type MerchantOverrideRow,
  type NewAccount,
  type NewAsset,
  type NewBudget,
  type NewCategory,
  type NewContribution,
  type NewFixedExpense,
  type NewMerchantOverride,
  type NewPerson,
  type NewRule,
  type NewTransaction,
  type NewUser,
  type PersonRow,
  type RuleRow,
  type TransactionRow,
  type UserRow,
} from "@domain/entities";
import {
  AccountEntity,
  AssetEntity,
  BudgetEntity,
  CategoryEntity,
  ContributionEntity,
  FixedExpenseEntity,
  MerchantOverrideEntity,
  PersonEntity,
  RuleEntity,
  SettingEntity,
  TransactionEntity,
  UserEntity,
} from "@infrastructure/persistence/schemas";
import type {
  AssetRepository,
  UserRepository,
  BudgetRepository,
  ContributionRepository,
  FixedExpenseRepository,
  MerchantOverrideRepository,
  RuleRepository,
  SettingsRepository,
  TransactionRepository,
} from "@domain/repositories";
import { getDataSource } from "@infrastructure/persistence/client";
import { TypeOrmRepository } from "./typeorm-repository";
import { TypeOrmAssetRepository } from "./asset-repository";
import { TypeOrmUserRepository } from "./user-repository";

/**
 * The composition root: where the ports declared in `@domain/repositories` are
 * bound to Postgres.
 *
 * Next.js route handlers have no DI container, and introducing one for a
 * single-database local-first app would be ceremony. Binding happens once here
 * instead, and each use case names what it needs in a `deps` parameter that
 * defaults to these — so the seam is real (a test passes its own) without a
 * registry to resolve through or a decorator to read past.
 *
 * Instances are cheap and hold no connection: `TypeOrmRepository` resolves the
 * DataSource lazily per call, which is what keeps `next build` database-free.
 */

export const accounts = new TypeOrmRepository<Account, AccountRow, NewAccount>(
  AccountEntity,
  Account,
  { name: "ASC" },
);

export const assets: AssetRepository = new TypeOrmAssetRepository(AssetEntity, Asset, {
  name: "ASC",
});

class TypeOrmBudgetRepository
  extends TypeOrmRepository<Budget, BudgetRow, NewBudget>
  implements BudgetRepository
{
  async deleteByCategory(categoryId: number): Promise<void> {
    await (await this.repo()).delete({ categoryId });
  }

  async findByCategory(categoryId: number): Promise<Budget | null> {
    const row = await (await this.repo()).findOne({ where: { categoryId } });
    return row ? Budget.reconstitute(row) : null;
  }
}

export const budgets: BudgetRepository = new TypeOrmBudgetRepository(BudgetEntity, Budget);

class TypeOrmMerchantOverrideRepository
  extends TypeOrmRepository<MerchantOverride, MerchantOverrideRow, NewMerchantOverride>
  implements MerchantOverrideRepository
{
  async findByKey(merchantKey: string): Promise<MerchantOverride | null> {
    const row = await (await this.repo()).findOne({ where: { merchantKey } });
    return row ? MerchantOverride.reconstitute(row) : null;
  }

  async deleteByKey(merchantKey: string): Promise<boolean> {
    const result = await (await this.repo()).delete({ merchantKey });
    return (result.affected ?? 0) > 0;
  }

}

export const merchantOverrides: MerchantOverrideRepository =
  new TypeOrmMerchantOverrideRepository(MerchantOverrideEntity, MerchantOverride);

export const categories = new TypeOrmRepository<Category, CategoryRow, NewCategory>(
  CategoryEntity,
  Category,
  { name: "ASC" },
);

class TypeOrmContributionRepository
  extends TypeOrmRepository<Contribution, ContributionRow, NewContribution>
  implements ContributionRepository
{
  async deleteByPerson(personId: number): Promise<void> {
    await (await this.repo()).delete({ personId });
  }
}

export const contributions: ContributionRepository = new TypeOrmContributionRepository(
  ContributionEntity,
  Contribution,
  { name: "ASC" },
);

class TypeOrmFixedExpenseRepository
  extends TypeOrmRepository<FixedExpense, FixedExpenseRow, NewFixedExpense>
  implements FixedExpenseRepository
{
  async clearCategory(categoryId: number): Promise<void> {
    await (await this.repo()).update({ categoryId }, { categoryId: null } as never);
  }
}

export const fixedExpenses: FixedExpenseRepository = new TypeOrmFixedExpenseRepository(
  FixedExpenseEntity,
  FixedExpense,
  { name: "ASC" },
);

export const persons = new TypeOrmRepository<Person, PersonRow, NewPerson>(PersonEntity, Person, {
  name: "ASC",
});

class TypeOrmRuleRepository
  extends TypeOrmRepository<Rule, RuleRow, NewRule>
  implements RuleRepository
{
  async deleteByCategory(categoryId: number): Promise<void> {
    await (await this.repo()).delete({ categoryId });
  }
}

export const rules: RuleRepository = new TypeOrmRuleRepository(RuleEntity, Rule, {
  priority: "ASC",
});

class TypeOrmTransactionRepository
  extends TypeOrmRepository<Transaction, TransactionRow, NewTransaction>
  implements TransactionRepository
{
  async findForCategorization(onlyUncategorized: boolean): Promise<TransactionRow[]> {
    const repo = await this.repo();
    return onlyUncategorized ? repo.find({ where: { categoryId: IsNull() } }) : repo.find();
  }

  async setCategory(transactionId: number, categoryId: number | null): Promise<void> {
    await (await this.repo()).update(transactionId, { categoryId });
  }

  async countByAccount(accountId: number): Promise<number> {
    return (await this.repo()).countBy({ accountId } as never);
  }

  async countByAccountGrouped(): Promise<Map<number, number>> {
    const rows = await (await this.repo())
      .createQueryBuilder("t")
      .select("t.account_id", "accountId")
      .addSelect("COUNT(*)", "count")
      .groupBy("t.account_id")
      .getRawMany<{ accountId: number; count: string }>();
    // Postgres returns count() as a string; the aggregate convention here is
    // to wrap raw numerics in Number(...) at the boundary.
    return new Map(rows.map((r) => [Number(r.accountId), Number(r.count)]));
  }

  async clearCategory(categoryId: number): Promise<void> {
    await (await this.repo()).update({ categoryId }, { categoryId: null } as never);
  }
}

export const transactions: TransactionRepository = new TypeOrmTransactionRepository(
  TransactionEntity,
  Transaction,
  { date: "DESC" },
);

export const users: UserRepository = new TypeOrmUserRepository(UserEntity, User, {
  id: "ASC",
});

class TypeOrmSettingsRepository implements SettingsRepository {
  async get(key: string): Promise<string | null> {
    const ds = await getDataSource();
    const row = await ds.getRepository(SettingEntity).findOne({ where: { key } });
    // The column is jsonb, so anything could be in there; narrowing to what the
    // port promises is this adapter's job, not its callers'.
    return typeof row?.value === "string" ? row.value : null;
  }

  // settings.key is the PK → save upserts.
  async set(key: string, value: string): Promise<void> {
    const ds = await getDataSource();
    await ds.getRepository(SettingEntity).save({ key, value });
  }

  async enableEnforcedAuth(ownerId: number, passwordHash: string, email?: string): Promise<void> {
    const ds = await getDataSource();
    await ds.transaction(async (manager) => {
      await manager.getRepository(UserEntity).update(ownerId, {
        passwordHash,
        ...(email ? { email } : {}),
      });
      await manager.getRepository(SettingEntity).save({ key: "authMode", value: "enforced" });
    });
  }
}

export const settings: SettingsRepository = new TypeOrmSettingsRepository();
