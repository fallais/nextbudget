import { expect } from "vitest";
import { MERCHANT_CATALOG } from "./index";
import { DEFAULT_CATEGORIES } from "../default-categories";
import { compileMerchants, resolveMerchants, type MerchantEntry } from "@domain/services/merchant-catalog";
import { matchCategoryId, orderRules } from "@domain/services/categorization";
import { normalizeDescription } from "@domain/value-objects/normalized-description";

/**
 * Shared ground for the per-file catalogue tests.
 *
 * Matching is always run against the **whole** catalogue, never against one
 * file: the interesting failures are collisions between files — UBER against
 * UBER EATS, ORANGE against L'ORANGE BLEUE — and a test that compiled only its
 * own file would pass while the app got it wrong. Integrity, on the other
 * hand, is checked file by file, which is what the per-file tests add.
 */

/** Category ids as a fresh install would number them. */
const CATEGORY_ID = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.name, i + 1]));

export const idOf = (name: string) => CATEGORY_ID.get(name) ?? null;

const nameOf = (id: number | null) =>
  [...CATEGORY_ID.entries()].find(([, v]) => v === id)?.[0] ?? null;

const RULES = orderRules(compileMerchants(resolveMerchants(MERCHANT_CATALOG, idOf, [])));

/** The category a statement line lands in, catalogue only — no user rules. */
export function categoryOf(description: string, amountCents = -1000): string | null {
  return nameOf(matchCategoryId(normalizeDescription(description), amountCents, RULES));
}

/** Which catalogue entry claimed the line, as `merchant:<key>`. */
export function matchedEntry(description: string, amountCents = -1000): string | null {
  return RULES.find((r) => r.test(normalizeDescription(description), amountCents))?.origin ?? null;
}

/**
 * Three letters match by accident. These are the ones worth the risk — brand
 * acronyms with no common French word containing them — and the list lives
 * here rather than in the data so that adding one is a decision someone had to
 * write down. Anything else short needs a `\bWORD\b` regex instead.
 */
export const SHORT_ALLOWED = ["KFC", "KLM", "EDF", "SFR", "MMA", "AXA", "GMF", "H&M", "UGC", "N26"];

/** The checks every catalogue file has to pass, whatever it is about. */
export function expectWellFormed(entries: MerchantEntry[]): void {
  const seen = new Set<string>();

  for (const entry of entries) {
    expect(entry.key, `duplicate key ${entry.key}`).not.toBe([...seen].find((k) => k === entry.key));
    seen.add(entry.key);

    // Keys travel in URLs and in the overrides table; keep them boring.
    expect(entry.key, entry.name).toMatch(/^[a-z0-9-]+$/);
    expect(entry.name.trim().length, entry.key).toBeGreaterThan(0);

    // An entry with nothing to match on is dead weight that reads as coverage.
    expect(entry.patterns.length + (entry.regex ? 1 : 0), entry.key).toBeGreaterThan(0);

    if (entry.regex) {
      expect(() => new RegExp(entry.regex!, "i"), entry.key).not.toThrow();
    }

    for (const pattern of entry.patterns) {
      const norm = normalizeDescription(pattern);
      expect(norm.length, `${entry.key}: "${pattern}" is empty once normalised`).toBeGreaterThan(0);
      if (norm.length < 4) {
        expect(SHORT_ALLOWED, `${entry.key}: "${pattern}" is short and not allowlisted`).toContain(
          norm,
        );
      }
    }
  }
}

/** Every entry in the file files into a category a fresh install seeds. */
export function expectCategoriesExist(entries: MerchantEntry[]): void {
  for (const m of resolveMerchants(entries, idOf, [])) {
    expect(m.categoryId, `${m.entry.key} files into a category no install has`).not.toBeNull();
  }
}
