/**
 * Persistence ports. Interfaces only — see `./repository` for why there is one
 * generic contract instead of one interface per table, and why a handful of
 * tables extend it.
 */
export type { Repository } from "./repository";
export type { EntityFactory } from "./entity-factory";
export type { TransactionRepository } from "./transaction-repository";
export type { ContributionRepository } from "./contribution-repository";
export type { AssetRepository, AssetOwnerInput } from "./asset-repository";
export type { UserRepository } from "./user-repository";
export type { MerchantOverrideRepository } from "./merchant-override";
export type {
  BudgetRepository,
  FixedExpenseRepository,
  RuleRepository,
} from "./category-dependents";
