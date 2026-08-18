/**
 * The things this app is about.
 *
 * Each entity exports two names: the class (behaviour and invariants, server
 * side) and its `*Row` type — the persisted shape, which is also the DTO the
 * UI receives, since class instances cannot cross into a Client Component.
 *
 * The TypeORM mapping lives in `@infrastructure/persistence/schemas` and the
 * row ⇄ entity translation in `@infrastructure/persistence/repositories`, so nothing here
 * knows how a row is stored.
 */

export { Account } from "./account";
export type { AccountRow, NewAccount } from "./account";

export { Asset } from "./asset";
export type { AssetRow, NewAsset } from "./asset";

export type { AssetOwnerRow, NewAssetOwner } from "./asset-owner";
export type { AssetValuationRow, NewAssetValuation } from "./asset-valuation";

export { Budget } from "./budget";
export type { BudgetRow, NewBudget } from "./budget";

export { Category } from "./category";
export type { CategoryRow, NewCategory } from "./category";

export { Contribution } from "./contribution";
export type { ContributionRow, NewContribution } from "./contribution";

export { FixedExpense } from "./fixed-expense";
export type { FixedExpenseRow, NewFixedExpense } from "./fixed-expense";

export type { ImportRow } from "./import";

export { Person } from "./person";
export type { PersonRow, NewPerson } from "./person";

export { Rule } from "./rule";
export type { RuleRow, NewRule } from "./rule";

export type { SessionRow } from "./session";
export type { SettingRow } from "./setting";

export { Transaction } from "./transaction";
export type { TransactionRow, NewTransaction } from "./transaction";

export { User } from "./user";
export type { UserRow, NewUser } from "./user";
