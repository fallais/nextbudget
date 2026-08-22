import type { AmountCondition, MerchantKind } from "@domain/enums";
import { MERCHANT_KIND_CATEGORY } from "@domain/enums";
import { compileRule, type CompiledRule } from "./categorization";

/**
 * One known merchant, or one generic heuristic, as shipped with the app.
 *
 * The catalogue is data the domain *interprets*; it does not live here (see
 * `@infrastructure/categorize/catalog`). What lives here is its shape, and the
 * rules for turning it into something the engine can run.
 */
export type MerchantEntry = {
  /** Stable, kebab-case, never reused: user overrides are keyed on it. */
  key: string;
  /** How the merchant is named in the interface. */
  name: string;
  kind: MerchantKind;
  /**
   * Text looked for in the normalised description. Case, accents and
   * punctuation are already flattened, so write them the way you would say
   * them. Several per merchant is normal — a chain rarely has one label.
   */
  patterns: string[];
  /** For the few cases a substring cannot express, e.g. a word boundary. */
  regex?: string;
  /** Restricts the entry to money in or money out. */
  amountCondition?: AmountCondition;
  /**
   * Lower wins. Leave it alone: specificity already resolves the ordinary
   * conflicts. Set it only for genuinely generic patterns that must stay
   * behind every named merchant.
   */
  priority?: number;
};

/**
 * What the user did to a shipped entry: switched it off.
 *
 * The only decision on offer. Where a merchant files is the catalogue's to
 * say — a kind maps to a category and that mapping travels with the release,
 * so re-pointing one entry by hand would freeze it against the next
 * correction. Disagreeing with the catalogue is what a rule of your own is
 * for, and a rule outranks it.
 */
export type MerchantOverrideInput = {
  merchantKey: string;
  /** Switched off entirely: the entry stops matching anything. */
  disabled: boolean;
};

export type ResolvedMerchant = {
  entry: MerchantEntry;
  /** Where it files — `null` when its category does not exist here. */
  categoryId: number | null;
  disabled: boolean;
};

/** The default priority of a catalogue entry, when it does not state one. */
const DEFAULT_PRIORITY = 100;

/**
 * Apply the user's overrides to the shipped catalogue.
 *
 * Separated from compiling so the same resolution feeds the merchants screen,
 * which has to show what *would* happen as much as what does.
 */
export function resolveMerchants(
  entries: MerchantEntry[],
  categoryIdByName: (name: string) => number | null,
  overrides: MerchantOverrideInput[],
): ResolvedMerchant[] {
  const byKey = new Map(overrides.map((o) => [o.merchantKey, o]));

  return entries.map((entry) => ({
    entry,
    categoryId: categoryIdByName(MERCHANT_KIND_CATEGORY[entry.kind]),
    disabled: byKey.get(entry.key)?.disabled ?? false,
  }));
}

/**
 * The catalogue as rules the engine can run, one per pattern.
 *
 * One rule per pattern rather than one per merchant, because specificity is a
 * property of the pattern that matched: "CARREFOUR CITY" and "CARREFOUR" are
 * the same shop but not the same evidence.
 */
export function compileMerchants(resolved: ResolvedMerchant[]): CompiledRule[] {
  const out: CompiledRule[] = [];

  for (const m of resolved) {
    if (m.disabled || m.categoryId === null) continue;
    const { entry } = m;
    const meta = { source: "catalog" as const, origin: `merchant:${entry.key}` };
    const common = {
      // Catalogue rules have no row of their own; `origin` identifies them.
      id: 0,
      categoryId: m.categoryId,
      amountCondition: entry.amountCondition ?? ("any" as AmountCondition),
      priority: entry.priority ?? DEFAULT_PRIORITY,
    };

    for (const pattern of entry.patterns) {
      const compiled = compileRule({ ...common, pattern, matchType: "contains" }, meta);
      if (compiled) out.push(compiled);
    }
    if (entry.regex) {
      const compiled = compileRule({ ...common, pattern: entry.regex, matchType: "regex" }, meta);
      if (compiled) out.push(compiled);
    }
  }

  return out;
}
