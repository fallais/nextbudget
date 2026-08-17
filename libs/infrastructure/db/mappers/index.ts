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
  type PersonRow,
  type RuleRow,
  type TransactionRow,
  type UserRow,
} from "@domain/entities";

/**
 * Row ⇄ entity translation.
 *
 * TypeORM hydrates plain objects from `EntitySchema`, never class instances,
 * so this is the seam where persisted data becomes a domain object with
 * behaviour. Reads use `reconstitute` rather than `create`: a row that is
 * already in the database was valid when it was written, and re-validating it
 * on every read would make a rule change retroactively break existing data.
 *
 * Writes go the other way through `toRow()`, and `create()` is what guards the
 * way in — see the API routes.
 */

export const toAccount = (row: AccountRow): Account => Account.reconstitute(row);
export const toAsset = (row: AssetRow): Asset => Asset.reconstitute(row);
export const toBudget = (row: BudgetRow): Budget => Budget.reconstitute(row);
export const toCategory = (row: CategoryRow): Category => Category.reconstitute(row);
export const toContribution = (row: ContributionRow): Contribution =>
  Contribution.reconstitute(row);
export const toFixedExpense = (row: FixedExpenseRow): FixedExpense =>
  FixedExpense.reconstitute(row);
export const toPerson = (row: PersonRow): Person => Person.reconstitute(row);
export const toRule = (row: RuleRow): Rule => Rule.reconstitute(row);
export const toTransaction = (row: TransactionRow): Transaction =>
  Transaction.reconstitute(row);
export const toUser = (row: UserRow): User => User.reconstitute(row);

/** Map a list, keeping the call sites free of `.map(x => ...)` noise. */
export const toEntities =
  <TRow, TEntity>(map: (row: TRow) => TEntity) =>
  (rows: TRow[]): TEntity[] =>
    rows.map(map);
