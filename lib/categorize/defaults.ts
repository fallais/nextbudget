import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Default categories and merchant patterns, read from `categories.yaml` and
 * seeded into the DB by `npm run db:migrate`.
 *
 * The file is a starting point, not a live layer: once seeded, the `rules`
 * table is the only source the engine consults, so anything you change on the
 * Rules page stays changed.
 */

const DEFAULTS_FILE = path.join(process.cwd(), "lib", "categorize", "categories.yaml");

/** A bare string is the common case: "contains", any amount, priority 100. */
const patternSchema = z.union([
  z.string().min(1),
  z.object({
    pattern: z.string().min(1),
    matchType: z.enum(["contains", "equals", "starts_with", "regex"]).optional(),
    amountCondition: z.enum(["any", "positive", "negative"]).optional(),
    priority: z.number().int().optional(),
  }),
]);

const categorySchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  patterns: z.array(patternSchema).default([]),
});

const fileSchema = z.object({
  categories: z.array(categorySchema).default([]),
});

export type DefaultPattern = {
  pattern: string;
  matchType: "contains" | "equals" | "starts_with" | "regex";
  amountCondition: "any" | "positive" | "negative";
  priority: number;
};

export type DefaultCategory = {
  name: string;
  color?: string;
  icon?: string;
  patterns: DefaultPattern[];
};

function normalise(raw: z.infer<typeof patternSchema>): DefaultPattern {
  const obj = typeof raw === "string" ? { pattern: raw } : raw;
  return {
    pattern: obj.pattern,
    matchType: obj.matchType ?? "contains",
    amountCondition: obj.amountCondition ?? "any",
    priority: obj.priority ?? 100,
  };
}

export function loadDefaultCategories(): DefaultCategory[] {
  if (!fs.existsSync(DEFAULTS_FILE)) return [];
  const parsed = fileSchema.safeParse(parseYaml(fs.readFileSync(DEFAULTS_FILE, "utf8")));
  if (!parsed.success) {
    throw new Error(
      `Invalid ${path.basename(DEFAULTS_FILE)}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data.categories.map((c) => ({
    name: c.name,
    color: c.color,
    icon: c.icon,
    patterns: c.patterns.map(normalise),
  }));
}
