import { z } from "zod";

export const matchTypeSchema = z.enum(["contains", "equals", "starts_with", "regex"]);
export const amountConditionSchema = z.enum(["any", "positive", "negative"]);

export const budgetPeriodSchema = z.enum(["weekly", "monthly"]);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur HEX attendue (ex. #16a34a)"),
  icon: z.string().min(1).max(64),
});

export const categoryBudgetSchema = z
  .object({
    budgetAmountCents: z.number().int().positive().nullable(),
    budgetPeriod: budgetPeriodSchema.nullable(),
  })
  .refine(
    (d) =>
      (d.budgetAmountCents === null && d.budgetPeriod === null) ||
      (d.budgetAmountCents !== null && d.budgetPeriod !== null),
    {
      message: "Le montant et la période doivent être définis ou nuls ensemble",
    },
  );

export const fixedExpenseMatchTypeSchema = z.enum(["contains", "starts_with", "regex"]);

export const personInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
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
