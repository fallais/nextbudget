import "server-only";
import {
  Account,
  Asset,
  Budget,
  Category,
  Contribution,
  FixedExpense,
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
  type NewAccount,
  type NewAsset,
  type NewBudget,
  type NewCategory,
  type NewContribution,
  type NewFixedExpense,
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
  PersonEntity,
  RuleEntity,
  TransactionEntity,
  UserEntity,
} from "@infrastructure/persistence/schemas";
import type {
  AssetRepository,
  UserRepository,
  BudgetRepository,
  ContributionRepository,
  FixedExpenseRepository,
  RuleRepository,
  TransactionRepository,
} from "@domain/repositories";
import { TypeOrmRepository } from "./typeorm-repository";
import { TypeOrmAssetRepository } from "./asset-repository";
import { TypeOrmUserRepository } from "./user-repository";

/**
 * The composition root: where the ports declared in `@domain/repositories` are
 * bound to Postgres.
 *
 * Next.js route handlers have no DI container, and introducing one for a
 * single-database local-first app would be ceremony. Binding happens once here
 * instead, and use cases import these — so swapping an implementation is an
 * edit to this file, not a hunt through thirty routes.
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
}

export const budgets: BudgetRepository = new TypeOrmBudgetRepository(BudgetEntity, Budget);

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
