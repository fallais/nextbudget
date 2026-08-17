/**
 * Row shapes and value types for everything the app tracks.
 *
 * Pure types with no persistence concern: the TypeORM `EntitySchema`
 * definitions that map them to tables live in
 * `@infrastructure/db/schemas`. Anything outside infrastructure should import
 * from here, so the domain never depends on how rows are stored.
 */

export type Visibility = "private" | "shared";
export type MatchType = "contains" | "equals" | "starts_with" | "regex";
export type PersonMatchType = "contains" | "starts_with" | "regex";
export type AmountCondition = "any" | "positive" | "negative";
export type Period = "weekly" | "monthly";

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
  /** Assurance emprunteur, per month. Often a fifth of a French mortgage's cost. */
  insuranceMonthlyCents: number | null;
  /** One-off costs: frais de dossier, garantie, courtier. */
  feesCents: number | null;
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

