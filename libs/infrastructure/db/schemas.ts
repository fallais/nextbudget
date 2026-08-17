import { EntitySchema, type ValueTransformer } from "typeorm";
import type {
  User, Session, Setting, Account, Category, Rule, Transaction, Person,
  Contribution, FixedExpense, Budget, Asset, AssetOwner, AssetValuation, Import,
} from "@domain/entities";

/**
 * How domain rows map to Postgres tables. `synchronize: true` derives the
 * schema from these, so this file is the migration story.
 */

// Postgres returns bigint (int8) and numeric as strings. Store money as bigint
// (safe for net-worth/mortgage sizes) but expose it as a JS number.
const bigintNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? v : Number(v)),
};

// ── EntitySchemas ────────────────────────────────────────────────────────────

const id = { type: Number, primary: true, generated: "increment" as const };
const createdAt = { name: "created_at", type: "timestamptz" as const, createDate: true };
const owner = {
  ownerId: { name: "owner_id", type: Number, nullable: true },
  visibility: { type: "text" as const, default: "shared" },
};

export const UserEntity = new EntitySchema<User>({
  name: "users",
  columns: {
    id,
    name: { type: "text" },
    email: { type: "text", nullable: true, unique: true },
    passwordHash: { name: "password_hash", type: "text", nullable: true },
    role: { type: "text", default: "member" },
    isActive: { name: "is_active", type: Boolean, default: true },
    createdAt,
  },
});

export const SessionEntity = new EntitySchema<Session>({
  name: "sessions",
  columns: {
    id: { type: "text", primary: true },
    userId: { name: "user_id", type: Number },
    expiresAt: { name: "expires_at", type: "timestamptz" },
  },
  indices: [{ name: "sessions_user_idx", columns: ["userId"] }],
});

export const SettingEntity = new EntitySchema<Setting>({
  name: "settings",
  columns: {
    key: { type: "text", primary: true },
    value: { type: "jsonb", nullable: true },
  },
});

export const AccountEntity = new EntitySchema<Account>({
  name: "accounts",
  columns: {
    id,
    ...owner,
    kind: { type: "text", default: "personal" },
    name: { type: "text" },
    bank: { type: "text", nullable: true },
    iban: { type: "text", nullable: true },
    currency: { type: "text", default: "EUR" },
    createdAt,
  },
});

export const CategoryEntity = new EntitySchema<Category>({
  name: "categories",
  columns: {
    id,
    name: { type: "text", unique: true },
    color: { type: "text", default: "#6b7280" },
    icon: { type: "text", default: "Tag" },
    isDefault: { name: "is_default", type: Boolean, default: false },
    createdAt,
  },
});

export const RuleEntity = new EntitySchema<Rule>({
  name: "rules",
  columns: {
    id,
    ...owner,
    categoryId: { name: "category_id", type: Number },
    pattern: { type: "text" },
    matchType: { name: "match_type", type: "text", default: "contains" },
    amountCondition: { name: "amount_condition", type: "text", default: "any" },
    priority: { type: Number, default: 100 },
    isActive: { name: "is_active", type: Boolean, default: true },
    createdAt,
  },
  indices: [{ name: "rules_priority_idx", columns: ["priority"] }],
});

export const TransactionEntity = new EntitySchema<Transaction>({
  name: "transactions",
  columns: {
    id,
    accountId: { name: "account_id", type: Number },
    categoryId: { name: "category_id", type: Number, nullable: true },
    date: { type: "text" },
    description: { type: "text" },
    normalizedDescription: { name: "normalized_description", type: "text" },
    amountCents: { name: "amount_cents", type: "bigint", transformer: bigintNumber },
    currency: { type: "text", default: "EUR" },
    hash: { type: "text" },
    sourceFile: { name: "source_file", type: "text", nullable: true },
    raw: { type: "jsonb", nullable: true },
    createdAt,
  },
  indices: [
    { name: "transactions_date_idx", columns: ["date"] },
    { name: "transactions_category_idx", columns: ["categoryId"] },
    { name: "transactions_account_idx", columns: ["accountId"] },
    // Dedup is per account, not global. The hash stays a pure content
    // fingerprint — two people can genuinely pay the same merchant the same
    // amount on the same day from different accounts, and a global unique
    // index would silently drop the second one on import.
    {
      name: "transactions_account_hash_uniq",
      columns: ["accountId", "hash"],
      unique: true,
    },
  ],
});

export const PersonEntity = new EntitySchema<Person>({
  name: "persons",
  columns: {
    id,
    userId: { name: "user_id", type: Number, nullable: true },
    name: { type: "text" },
    monthlySalaryCents: {
      name: "monthly_salary_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    matchPattern: { name: "match_pattern", type: "text", nullable: true },
    matchType: { name: "match_type", type: "text", nullable: true, default: "contains" },
    tolerancePct: { name: "tolerance_pct", type: Number, default: 5 },
    isActive: { name: "is_active", type: Boolean, default: true },
    createdAt,
  },
});

export const ContributionEntity = new EntitySchema<Contribution>({
  name: "contributions",
  columns: {
    id,
    ...owner,
    personId: { name: "person_id", type: Number },
    name: { type: "text" },
    expectedAmountCents: {
      name: "expected_amount_cents",
      type: "bigint",
      transformer: bigintNumber,
    },
    matchPattern: { name: "match_pattern", type: "text" },
    matchType: { name: "match_type", type: "text", default: "contains" },
    tolerancePct: { name: "tolerance_pct", type: Number, default: 10 },
    isActive: { name: "is_active", type: Boolean, default: true },
    notes: { type: "text", nullable: true },
    createdAt,
  },
});

export const FixedExpenseEntity = new EntitySchema<FixedExpense>({
  name: "fixed_expenses",
  columns: {
    id,
    ...owner,
    name: { type: "text" },
    categoryId: { name: "category_id", type: Number, nullable: true },
    liabilityId: { name: "liability_id", type: Number, nullable: true },
    expectedAmountCents: {
      name: "expected_amount_cents",
      type: "bigint",
      transformer: bigintNumber,
    },
    tolerancePct: { name: "tolerance_pct", type: Number, default: 10 },
    dueDay: { name: "due_day", type: Number, nullable: true },
    matchPattern: { name: "match_pattern", type: "text" },
    matchType: { name: "match_type", type: "text", default: "contains" },
    isActive: { name: "is_active", type: Boolean, default: true },
    notes: { type: "text", nullable: true },
    createdAt,
  },
});

export const BudgetEntity = new EntitySchema<Budget>({
  name: "budgets",
  columns: {
    id,
    categoryId: { name: "category_id", type: Number },
    ...owner,
    amountCents: { name: "amount_cents", type: "bigint", transformer: bigintNumber },
    period: { type: "text", default: "monthly" },
    createdAt,
  },
  indices: [
    {
      name: "budgets_cat_owner_period_uniq",
      columns: ["categoryId", "ownerId", "period"],
      unique: true,
    },
  ],
});

export const AssetEntity = new EntitySchema<Asset>({
  name: "assets",
  columns: {
    id,
    ...owner,
    name: { type: "text" },
    kind: { type: "text" },
    type: { type: "text", default: "other" },
    valueCents: {
      name: "value_cents",
      type: "bigint",
      default: 0,
      transformer: bigintNumber,
    },
    currency: { type: "text", default: "EUR" },
    principalCents: {
      name: "principal_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    interestRateBps: { name: "interest_rate_bps", type: Number, nullable: true },
    termMonths: { name: "term_months", type: Number, nullable: true },
    monthlyPaymentCents: {
      name: "monthly_payment_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    insuranceMonthlyCents: {
      name: "insurance_monthly_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    feesCents: {
      name: "fees_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    startDate: { name: "start_date", type: "text", nullable: true },
    endDate: { name: "end_date", type: "text", nullable: true },
    accountId: { name: "account_id", type: Number, nullable: true },
    linkedAssetId: { name: "linked_asset_id", type: Number, nullable: true },
    isActive: { name: "is_active", type: Boolean, default: true },
    notes: { type: "text", nullable: true },
    createdAt,
  },
});

export const AssetOwnerEntity = new EntitySchema<AssetOwner>({
  name: "asset_owners",
  columns: {
    id,
    assetId: { name: "asset_id", type: Number },
    personId: { name: "person_id", type: Number },
    shareBps: { name: "share_bps", type: Number },
  },
  indices: [
    { name: "asset_owners_asset_idx", columns: ["assetId"] },
    {
      name: "asset_owners_asset_person_uniq",
      columns: ["assetId", "personId"],
      unique: true,
    },
  ],
});

export const AssetValuationEntity = new EntitySchema<AssetValuation>({
  name: "asset_valuations",
  columns: {
    id,
    assetId: { name: "asset_id", type: Number },
    date: { type: "text" },
    valueCents: { name: "value_cents", type: "bigint", transformer: bigintNumber },
  },
  indices: [{ name: "asset_valuations_asset_idx", columns: ["assetId"] }],
});

export const ImportEntity = new EntitySchema<Import>({
  name: "imports",
  columns: {
    id,
    filename: { type: "text" },
    parser: { type: "text" },
    startedAt: { name: "started_at", type: "timestamptz", createDate: true },
    finishedAt: { name: "finished_at", type: "timestamptz", nullable: true },
    rowsTotal: { name: "rows_total", type: Number, default: 0 },
    rowsNew: { name: "rows_new", type: Number, default: 0 },
    rowsDuplicate: { name: "rows_duplicate", type: Number, default: 0 },
    rowsError: { name: "rows_error", type: Number, default: 0 },
    status: { type: "text", default: "success" },
    errorMessage: { name: "error_message", type: "text", nullable: true },
  },
});

export const ALL_ENTITIES = [
  UserEntity,
  SessionEntity,
  SettingEntity,
  AccountEntity,
  CategoryEntity,
  RuleEntity,
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
