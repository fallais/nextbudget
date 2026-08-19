import { normalizeDescription } from "@domain/value-objects/normalized-description";

export type AmountCondition = "any" | "positive" | "negative";

export type CompiledRule = {
  id: number;
  categoryId: number;
  priority: number;
  amountCondition: AmountCondition;
  /**
   * How much of the description a match consumed. Breaks a priority tie in
   * favour of the more specific pattern, which is what makes "UBER EATS" a
   * restaurant while "UBER" stays a ride — a distinction that used to need a
   * hand-tuned priority on both, and silently broke when either changed.
   */
  specificity: number;
  /** At equal priority and specificity, what you wrote beats what we shipped. */
  source: "user" | "catalog";
  /** Where the rule came from, for the UI: a rule id, or a merchant key. */
  origin: string;
  test: (normalizedDescription: string, amountCents: number) => boolean;
};

/**
 * Minimal shape `compileRule` needs. Decoupled from the `rules` table type so
 * that adding columns (e.g. owner/visibility) doesn't ripple into the many
 * synthetic-rule call sites. Tolerates extra fields present on DB rows and on
 * synthetic inputs (isActive/createdAt) without requiring them.
 */
export type RuleInput = {
  id: number;
  categoryId: number;
  pattern: string;
  matchType: "contains" | "equals" | "starts_with" | "regex";
  amountCondition: AmountCondition;
  priority: number;
  isActive?: boolean;
  createdAt?: Date;
};

export function compileRule(
  rule: RuleInput,
  meta: { source?: "user" | "catalog"; origin?: string } = {},
): CompiledRule | null {
  const pattern = rule.pattern;
  const norm = normalizeDescription(pattern);
  let textTest: (s: string) => boolean;
  switch (rule.matchType) {
    case "contains":
      textTest = (s) => s.includes(norm);
      break;
    case "equals":
      textTest = (s) => s === norm;
      break;
    case "starts_with":
      textTest = (s) => s.startsWith(norm);
      break;
    case "regex":
      try {
        const re = new RegExp(pattern, "i");
        textTest = (s) => re.test(s);
      } catch {
        return null;
      }
      break;
  }
  const condition = rule.amountCondition;
  return {
    id: rule.id,
    categoryId: rule.categoryId,
    priority: rule.priority,
    amountCondition: condition,
    specificity: norm.length,
    source: meta.source ?? "user",
    origin: meta.origin ?? `rule:${rule.id}`,
    test: (s, amount) => {
      if (!textTest(s)) return false;
      if (condition === "positive" && amount <= 0) return false;
      if (condition === "negative" && amount >= 0) return false;
      return true;
    },
  };
}

/**
 * The order rules are tried in — the whole precedence of the engine, in one
 * comparison: priority first (lower wins, as the Rules page says), then the
 * more specific pattern, then yours over ours.
 */
export function orderRules(rules: CompiledRule[]): CompiledRule[] {
  return [...rules].sort(
    (a, b) =>
      a.priority - b.priority ||
      b.specificity - a.specificity ||
      (a.source === b.source ? 0 : a.source === "user" ? -1 : 1),
  );
}

export function matchCategoryId(
  normalizedDescription: string,
  amountCents: number,
  compiledRules: CompiledRule[],
): number | null {
  for (const r of compiledRules) {
    if (r.test(normalizedDescription, amountCents)) return r.categoryId;
  }
  return null;
}

/**
 * Build synthetic compiled rules from active contributions. Each contribution
 * pattern was vetted by the user to identify a specific incoming apport, so
 * any positive transaction matching it is by definition an "Apport" and goes
 * to the Apports category — overriding generic category rules (EDF, Restaurants,
 * Orange…) that would otherwise win for labels like "DE JEAN - EDF".
 *
 * Priority 40 places these above specific merchant rules (≥50). Negative
 * transactions are unaffected because the synthetic rule is positive-only.
 */
export function compileContributionsAsRules(
  apportsCategoryId: number,
  activeContributions: Array<{
    id: number;
    matchPattern: string;
    matchType: "contains" | "starts_with" | "regex";
  }>,
): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const c of activeContributions) {
    if (!c.matchPattern || !c.matchPattern.trim()) continue;
    const r = compileRule({
      id: -100000 - c.id, // negative & offset so it doesn't collide with person-broad ids
      categoryId: apportsCategoryId,
      pattern: c.matchPattern,
      matchType: c.matchType,
      amountCondition: "positive",
      priority: 40,
      isActive: true,
      createdAt: new Date(),
    });
    if (r) out.push(r);
  }
  return out;
}

/**
 * Build synthetic compiled rules from active persons' broad patterns.
 * Any positive transaction matching such a pattern is by definition an
 * "Apport" and goes into the Apports category. Priority 40 places these
 * above specific merchant rules (≥50) so e.g. "DE JEAN - EDF" (positive
 * apport from Jean) does not get caught by the EDF Énergie rule.
 *
 * Specific rules with priority < 40 still win, leaving room for explicit
 * overrides if ever needed.
 */
export function compilePersonBroadRules(
  apportsCategoryId: number,
  activePersons: Array<{
    id: number;
    matchPattern: string | null;
    matchType: "contains" | "starts_with" | "regex" | null;
  }>,
): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const p of activePersons) {
    if (!p.matchPattern || !p.matchPattern.trim()) continue;
    const r = compileRule({
      id: -p.id, // negative id to distinguish synthetic rules
      categoryId: apportsCategoryId,
      pattern: p.matchPattern,
      matchType: p.matchType ?? "contains",
      amountCondition: "positive",
      priority: 40,
      isActive: true,
      createdAt: new Date(),
    });
    if (r) out.push(r);
  }
  return out;
}
