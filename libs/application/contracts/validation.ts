import { z } from "zod";
import { PREPAYMENT_MODES, PROPERTY_CONDITIONS, PROPERTY_KINDS } from "@domain/enums";

/**
 * The schema for a PATCH body: every field optional, and **defaults removed**.
 *
 * `.partial()` on its own is not enough. Zod keeps `.default()` on a key even
 * once it is optional, so a PATCH that omits a field still materialises that
 * field's default — and the route then writes it, silently resetting stored
 * values. Sending `{ owners: [...] }` to an asset would reset its type to
 * "other" and its value to 0. Unwrap the defaults before making keys optional.
 */
export function patchSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
): z.ZodType<Partial<z.infer<z.ZodObject<T>>>> {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, value]) => [
      key,
      value instanceof z.ZodDefault ? value.def.innerType : value,
    ]),
  );
  return z.object(shape).partial() as unknown as z.ZodType<
    Partial<z.infer<z.ZodObject<T>>>
  >;
}

export const matchTypeSchema = z.enum(["contains", "equals", "starts_with", "regex"]);
export const amountConditionSchema = z.enum(["any", "positive", "negative"]);

export const budgetPeriodSchema = z.enum(["weekly", "monthly"]);

export const visibilitySchema = z.enum(["private", "shared"]);
export const accountKindSchema = z.enum(["personal", "joint"]);

export const accountInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: accountKindSchema.default("personal"),
  bank: z.string().trim().max(80).nullable().optional(),
  iban: z.string().trim().max(34).nullable().optional(),
  currency: z.string().trim().length(3).default("EUR"),
  // The anchor a real balance is computed from. Signed: an account can be
  // overdrawn on the day you write it down.
  openingBalanceCents: z.number().int().nullable().optional(),
  openingBalanceDate: z.string().date().nullable().optional(),
  visibility: visibilitySchema.default("shared"),
  ownerId: z.number().int().positive().nullable().optional(),
});

export const accountUpdateSchema = patchSchema(accountInputSchema);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur HEX attendue (ex. #16a34a)"),
  icon: z.string().min(1).max(64),
});

export const budgetInputSchema = z.object({
  categoryId: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  period: budgetPeriodSchema.default("monthly"),
});

/** The category is a budget's identity, so a patch only ever moves the ceiling. */
export const budgetUpdateSchema = patchSchema(budgetInputSchema.omit({ categoryId: true }));

/**
 * A column mapping sent back by the import page's confirm step.
 *
 * Every field is optional: what the page does not send stays detected, so a
 * user who only corrects the amount column does not have to restate the rest.
 * `null` is meaningful and distinct from absent — it says "this file has no
 * such column", which is how a debit/credit pair replaces a single amount.
 */
export const columnMappingSchema = z.object({
  delimiter: z.string().min(1).max(4).optional(),
  headerRowIndex: z.number().int().min(0).max(500).optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  amount: z.string().nullable().optional(),
  debit: z.string().nullable().optional(),
  credit: z.string().nullable().optional(),
  dateFormat: z.string().nullable().optional(),
  invertSign: z.boolean().optional(),
});

/** Mappings keyed by filename — an upload can hold files of different shapes. */
export const mappingsByFileSchema = z.record(z.string(), columnMappingSchema);

export const fixedExpenseMatchTypeSchema = z.enum(["contains", "starts_with", "regex"]);

export const personInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // Optional link to a login. A person exists with or without one: in open
  // mode nobody logs in, but shares and contributions still need a subject.
  userId: z.number().int().positive().nullable().optional(),
  monthlySalaryCents: z.number().int().positive().nullable().optional(),
  matchPattern: z.string().trim().max(256).nullable().optional(),
  matchType: fixedExpenseMatchTypeSchema.optional(),
  tolerancePct: z.number().int().min(0).max(100).default(5),
  isActive: z.boolean().default(true),
});

export const contributionInputSchema = z.object({
  personId: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  expectedAmountCents: z.number().int().positive(),
  matchPattern: z.string().trim().min(1).max(256),
  matchType: fixedExpenseMatchTypeSchema.default("contains"),
  tolerancePct: z.number().int().min(0).max(100).default(10),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
});

export const fixedExpenseInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  categoryId: z.number().int().positive().nullable(),
  expectedAmountCents: z.number().int().positive(),
  tolerancePct: z.number().int().min(0).max(100).default(10),
  dueDay: z.number().int().min(1).max(31).nullable(),
  matchPattern: z.string().trim().min(1).max(256),
  matchType: fixedExpenseMatchTypeSchema.default("contains"),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
});

export const ruleInputSchema = z.object({
  categoryId: z.number().int().positive(),
  pattern: z.string().trim().min(1).max(256),
  matchType: matchTypeSchema.default("contains"),
  amountCondition: amountConditionSchema.default("any"),
  priority: z.number().int().min(0).max(10000).default(100),
  isActive: z.boolean().default(true),
});

export const updateTransactionSchema = z.object({
  categoryId: z.number().int().positive().nullable(),
});

/**
 * The lines being declared one transfer. One is allowed: money sent to an
 * account this app does not hold has no counterpart row to name, and still
 * has to stop counting as spending.
 */
export const transferInputSchema = z.object({
  transactionIds: z.array(z.number().int().positive()).min(1).max(10),
});

/** Optional span to search. Omitted, detection reads the whole ledger. */
export const transferDetectSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
}).nullable();

export const transactionFilterSchema = z.object({
  from: z.string().date().nullish(),
  to: z.string().date().nullish(),
  categoryIds: z.array(z.number().int()).optional(),
  accountIds: z.array(z.number().int()).optional(),
  uncategorized: z.boolean().optional(),
  search: z.string().trim().optional(),
  amountMin: z.number().int().optional(),
  amountMax: z.number().int().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
});

export const ruleTestSchema = z.object({
  pattern: z.string().min(1),
  matchType: matchTypeSchema.default("contains"),
  amountCondition: amountConditionSchema.default("any"),
});

// ── Auth (Phase 6) ───────────────────────────────────────────────────────────
export const roleSchema = z.enum(["owner", "member"]);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1), // email or name
  password: z.string().min(1),
});

// First-run: owner sets a password (and optional email) to switch to enforced mode.
export const enableAuthSchema = z.object({
  email: z.string().trim().email().nullish(),
  password: z.string().min(8, "8 caractères minimum"),
});

export const userInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().nullish(),
  role: roleSchema.default("member"),
  password: z.string().min(8, "8 caractères minimum").nullish(),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().nullish(),
  role: roleSchema.optional(),
  password: z.string().min(8, "8 caractères minimum").nullish(),
  isActive: z.boolean().optional(),
});

// ── Assets & liabilities (Phase 8) ───────────────────────────────────────────
export const assetKindSchema = z.enum(["asset", "liability"]);
export const assetTypeSchema = z.enum([
  "real_estate",
  "vehicle",
  "savings",
  "investment",
  "loan",
  "mortgage",
  "other",
]);

/**
 * Ownership shares. Omitted entirely ⇒ leave ownership as it is (and a brand
 * new asset falls back to "wholly the creator's"). Present ⇒ replaces the set,
 * and must total 100% — checked in the route via `validateShares`, which
 * returns a French message.
 */
export const assetOwnerSchema = z.object({
  personId: z.number().int().positive(),
  shareBps: z.number().int().min(1).max(10000),
  /** This borrower's assurance emprunteur, per month. Loans only. */
  insuranceMonthlyCents: z.number().int().min(0).nullish(),
});

export const assetInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: assetKindSchema,
  type: assetTypeSchema.default("other"),
  valueCents: z.number().int().default(0),
  currency: z.string().trim().min(1).max(8).default("EUR"),
  principalCents: z.number().int().nullish(),
  interestRateBps: z.number().int().min(0).max(100000).nullish(),
  taegBps: z.number().int().min(0).max(100000).nullish(),
  termMonths: z.number().int().min(1).max(1200).nullish(),
  monthlyPaymentCents: z.number().int().min(0).nullish(),
  insuranceMonthlyCents: z.number().int().min(0).nullish(),
  feesCents: z.number().int().min(0).nullish(),
  signatureDate: z.string().date().nullish(),
  startDate: z.string().date().nullish(),
  endDate: z.string().date().nullish(),
  address: z.string().trim().max(200).nullable().optional(),
  surfaceM2: z.number().int().min(1).max(100000).nullable().optional(),
  landM2: z.number().int().min(1).max(10000000).nullable().optional(),
  propertyKind: z.enum(PROPERTY_KINDS).nullable().optional(),
  propertyCondition: z.enum(PROPERTY_CONDITIONS).nullable().optional(),
  accountId: z.number().int().positive().nullish(),
  linkedAssetId: z.number().int().positive().nullish(),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).nullish(),
  owners: z.array(assetOwnerSchema).optional(),
});

export const assetUpdateSchema = patchSchema(assetInputSchema);

/** A remboursement anticipé: capital paid off ahead of the schedule. */
export const prepaymentInputSchema = z.object({
  date: z.string().date(),
  amountCents: z.number().int().positive(),
  mode: z.enum(PREPAYMENT_MODES).default("duration"),
  /** Indemnité de remboursement anticipé. */
  feesCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const assetValuationSchema = z.object({
  date: z.string().date(),
  valueCents: z.number().int(),
});
