import { z } from "zod";

/**
 * A pattern pack is a data file (YAML) describing default merchant→category
 * patterns. Packs are validated against this schema on load.
 *
 * Sources & roles (see CLAUDE.md → "Pattern packs"):
 *  - `lib/categorize/packs/core/*.yaml` — open-source defaults, seeded into the
 *    `rules` table at db:migrate (community contributions go here).
 *  - packs referenced by the `PATTERN_PACKS` env var — loaded at runtime as a
 *    fallback layer below the DB rules (personal/local packs and the proprietary
 *    SaaS "premium" pack). Never written to the DB.
 */
export const packRuleSchema = z.object({
  pattern: z.string().min(1),
  matchType: z.enum(["contains", "equals", "starts_with", "regex"]).optional(),
  amountCondition: z.enum(["any", "positive", "negative"]).optional(),
  priority: z.number().int().optional(),
});

export const packCategorySchema = z.object({
  name: z.string().min(1),
  // color/icon are only used when a core pack *creates* a category at seed time;
  // runtime packs reference existing categories by name and ignore these.
  color: z.string().optional(),
  icon: z.string().optional(),
  rules: z.array(packRuleSchema).default([]),
});

export const packSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categories: z.array(packCategorySchema).default([]),
});

export type PackRule = z.infer<typeof packRuleSchema>;
export type PackCategory = z.infer<typeof packCategorySchema>;
export type Pack = z.infer<typeof packSchema>;
