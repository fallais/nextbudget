import { EntitySchema, type ValueTransformer } from "typeorm";

// ── shared helpers ───────────────────────────────────────────────────────────

// Postgres returns bigint (int8) and numeric as strings. Store money as bigint
// (safe for net-worth/mortgage sizes) but expose it as a JS number.
const bigintNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? v : Number(v)),
};

type Visibility = "private" | "shared";
type MatchType = "contains" | "equals" | "starts_with" | "regex";
type PersonMatchType = "contains" | "starts_with" | "regex";
type AmountCondition = "any" | "positive" | "negative";
type Period = "weekly" | "monthly";

// ── row interfaces (replace Drizzle $inferSelect types) ──────────────────────

export interface User {
  id: number;
  name: string;
  email: string | null;
  passwordHash: string | null;
  role: "owner" | "member";
  isActive: boolean;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: number;
  expiresAt: Date;
}

export interface Setting {
  key: string;
  value: unknown | null;
}

/**
 * `personal` — one member's own account. `joint` — the household's common
 * account, the one contributions are paid into.
 *
 * Deliberately not derived from `visibility`: joint-ness is a fact about the
 * bank account itself, whereas visibility is about who may look at it. A
 * personal account can be shared (my partner can see my spending) without
 * becoming the common pot.
 */
export type AccountKind = "personal" | "joint";

export interface Account {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  kind: AccountKind;
  name: string;
  bank: string | null;
  iban: string | null;
  currency: string;
  createdAt: Date;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Rule {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  categoryId: number;
  pattern: string;
  matchType: MatchType;
  amountCondition: AmountCondition;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number | null;
  date: string;
  description: string;
  normalizedDescription: string;
  amountCents: number;
  currency: string;
  hash: string;
  sourceFile: string | null;
  raw: Record<string, unknown> | null;
  createdAt: Date;
}

export interface Person {
  id: number;
  userId: number | null;
  name: string;
  monthlySalaryCents: number | null;
  matchPattern: string | null;
  matchType: PersonMatchType | null;
  tolerancePct: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Contribution {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  personId: number;
  name: string;
  expectedAmountCents: number;
  matchPattern: string;
  matchType: PersonMatchType;
  tolerancePct: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface FixedExpense {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  name: string;
  categoryId: number | null;
  liabilityId: number | null;
  expectedAmountCents: number;
  tolerancePct: number;
  dueDay: number | null;
  matchPattern: string;
  matchType: PersonMatchType;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface Budget {
  id: number;
  categoryId: number;
  ownerId: number | null;
  visibility: Visibility;
  amountCents: number;
  period: Period;
  createdAt: Date;
}

export interface Asset {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  name: string;
  kind: "asset" | "liability";
  type:
    | "real_estate"
    | "vehicle"
    | "savings"
    | "investment"
    | "loan"
    | "mortgage"
    | "other";
  valueCents: number;
  currency: string;
  principalCents: number | null;
  interestRateBps: number | null;
  termMonths: number | null;
  monthlyPaymentCents: number | null;
  startDate: string | null;
  endDate: string | null;
  accountId: number | null;
  /** The asset this liability finances (a mortgage → the house it bought). */
  linkedAssetId: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

/**
 * Fractional ownership of an asset or liability by a household member.
 *
 * Shares are in basis points (10000 = 100%), matching `interestRateBps`.
 * Ownership is deliberately *not* the same axis as `visibility`: a share says
 * how much of a thing is yours, visibility says whether the other person can
 * see it exists at all. "I own 100%, my partner can see it" is a real and
 * common configuration.
 *
 * Nor is it the same as who *pays* for it: a house owned 50/50 can be funded
 * 70/30 through the joint account. That second fact lives in `contributions`
 * and `fixed_expenses`.
 *
 * An asset with no rows here reads as wholly owned by `assets.owner_id`, which
 * is what keeps every pre-existing row and every solo install correct without
 * a data migration.
 */
export interface AssetOwner {
  id: number;
  assetId: number;
  personId: number;
  shareBps: number;
}

export interface AssetValuation {
  id: number;
  assetId: number;
  date: string;
  valueCents: number;
}

export interface Import {
  id: number;
  filename: string;
  parser: string;
  startedAt: Date;
  finishedAt: Date | null;
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  rowsError: number;
  status: "success" | "partial" | "error";
  errorMessage: string | null;
}

// Insert helper types (id + createdAt are DB-managed).
export type NewTransaction = Omit<Transaction, "id" | "createdAt">;
export type NewAccount = Omit<Account, "id" | "createdAt">;

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
