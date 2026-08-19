import { describe, expect, it } from "vitest";
import { FOOD, HOME, LIFE, MERCHANT_CATALOG, MOBILITY, MONEY, SHOPPING } from "./index";
import { MERCHANT_KIND_CATEGORY, MERCHANT_KIND_LABELS, MERCHANT_KINDS } from "@domain/enums";
import { DEFAULT_CATEGORIES } from "../default-categories";
import { normalizeDescription } from "@domain/value-objects/normalized-description";
import { SHORT_ALLOWED, idOf } from "./testing";

/** What only holds across the whole catalogue — collisions between its files. */
describe("the catalogue as a whole", () => {
  it("is assembled from every file, with nothing left behind", () => {
    const parts = [FOOD, MOBILITY, HOME, SHOPPING, LIFE, MONEY];
    expect(MERCHANT_CATALOG.length).toBe(parts.reduce((n, p) => n + p.length, 0));
  });

  it("ships enough merchants to be worth calling a catalogue", () => {
    expect(MERCHANT_CATALOG.length).toBeGreaterThan(200);
  });

  it("never repeats a key — an override is stored against it", () => {
    const seen = new Map<string, string>();
    for (const entry of MERCHANT_CATALOG) {
      expect(seen.has(entry.key), `${entry.key} also declared by ${seen.get(entry.key)}`).toBe(
        false,
      );
      seen.set(entry.key, entry.name);
    }
  });

  it("never repeats a pattern across two merchants", () => {
    const owner = new Map<string, string>();
    for (const entry of MERCHANT_CATALOG) {
      for (const pattern of entry.patterns) {
        const norm = normalizeDescription(pattern);
        expect(owner.has(norm), `${pattern} in ${entry.key} and ${owner.get(norm)}`).toBe(false);
        owner.set(norm, entry.key);
      }
    }
  });

  it("files every kind into a category a fresh install seeds", () => {
    const seeded = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
    for (const kind of MERCHANT_KINDS) {
      expect(seeded.has(MERCHANT_KIND_CATEGORY[kind]), kind).toBe(true);
      expect(MERCHANT_KIND_LABELS[kind], kind).toBeTruthy();
      expect(idOf(MERCHANT_KIND_CATEGORY[kind]), kind).not.toBeNull();
    }
  });

  it("uses every kind it declares — an unused one is a category nobody fills", () => {
    const used = new Set(MERCHANT_CATALOG.map((m) => m.kind));
    expect([...MERCHANT_KINDS].filter((k) => !used.has(k))).toEqual([]);
  });

  it("keeps the short-pattern allowlist honest — every entry still in use", () => {
    const patterns = new Set(
      MERCHANT_CATALOG.flatMap((e) => e.patterns.map((p) => normalizeDescription(p))),
    );
    for (const allowed of SHORT_ALLOWED) {
      expect(patterns.has(allowed), `${allowed} is allowlisted but no longer used`).toBe(true);
    }
  });
});
