/**
 * How domain rows map to Postgres tables. `synchronize: true` derives the
 * schema from these, so this folder is the migration story: one file per
 * table, mirroring `libs/domain/entities/`, with the column fragments they
 * share in `./columns`.
 *
 * `ALL_ENTITIES` is what `client.ts` hands to the DataSource — a table missing
 * from that list is a table TypeORM will not create.
 */

import { AccountEntity } from "./account";
import { AssetEntity } from "./asset";
import { AssetOwnerEntity } from "./asset-owner";
import { AssetValuationEntity } from "./asset-valuation";
import { BudgetEntity } from "./budget";
import { CategoryEntity } from "./category";
import { ContributionEntity } from "./contribution";
import { FixedExpenseEntity } from "./fixed-expense";
import { ImportEntity } from "./import";
import { MerchantOverrideEntity } from "./merchant-override";
import { PersonEntity } from "./person";
import { RuleEntity } from "./rule";
import { SessionEntity } from "./session";
import { SettingEntity } from "./setting";
import { TransactionEntity } from "./transaction";
import { UserEntity } from "./user";

export { AccountEntity } from "./account";
export { AssetEntity } from "./asset";
export { AssetOwnerEntity } from "./asset-owner";
export { AssetValuationEntity } from "./asset-valuation";
export { BudgetEntity } from "./budget";
export { CategoryEntity } from "./category";
export { ContributionEntity } from "./contribution";
export { FixedExpenseEntity } from "./fixed-expense";
export { ImportEntity } from "./import";
export { MerchantOverrideEntity } from "./merchant-override";
export { PersonEntity } from "./person";
export { RuleEntity } from "./rule";
export { SessionEntity } from "./session";
export { SettingEntity } from "./setting";
export { TransactionEntity } from "./transaction";
export { UserEntity } from "./user";

export const ALL_ENTITIES = [
  UserEntity,
  SessionEntity,
  SettingEntity,
  AccountEntity,
  CategoryEntity,
  RuleEntity,
  MerchantOverrideEntity,
  TransactionEntity,
  PersonEntity,
  ContributionEntity,
  FixedExpenseEntity,
  BudgetEntity,
  AssetEntity,
  AssetOwnerEntity,
  AssetValuationEntity,
  ImportEntity,
];
