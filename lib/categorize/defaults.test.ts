import { describe, it, expect } from "vitest";
import { loadDefaultCategories } from "./defaults";

describe("default categories", () => {
  const categories = loadDefaultCategories();

  it("loads categories with their patterns", () => {
    expect(categories.length).toBeGreaterThan(0);
    const alimentation = categories.find((c) => c.name === "Alimentation");
    expect(alimentation).toBeDefined();
    expect(alimentation?.patterns.some((p) => p.pattern === "CARREFOUR")).toBe(true);
  });

  it("expands a bare string into a full rule with defaults", () => {
    const carrefour = categories
      .find((c) => c.name === "Alimentation")!
      .patterns.find((p) => p.pattern === "CARREFOUR");
    expect(carrefour).toEqual({
      pattern: "CARREFOUR",
      matchType: "contains",
      amountCondition: "any",
      priority: 100,
    });
  });

  it("keeps the explicit fields of a long-form rule", () => {
    const vinci = categories
      .find((c) => c.name === "Transport")!
      .patterns.find((p) => p.pattern === "VINCI");
    expect(vinci?.matchType).toBe("starts_with");

    const vir = categories
      .find((c) => c.name === "Apports")!
      .patterns.find((p) => p.pattern === "VIR ");
    expect(vir).toMatchObject({
      matchType: "starts_with",
      amountCondition: "positive",
      priority: 250,
    });
  });

  it("gives every category a colour and an icon to seed with", () => {
    for (const c of categories) {
      expect(c.color, c.name).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(c.icon, c.name).toBeTruthy();
    }
  });

  it("has no duplicate patterns — seeding keys on the pattern alone", () => {
    const seen = new Map<string, string>();
    for (const c of categories) {
      for (const p of c.patterns) {
        expect(seen.has(p.pattern), `${p.pattern} also in ${seen.get(p.pattern)}`).toBe(false);
        seen.set(p.pattern, c.name);
      }
    }
  });

  it("keeps a fallback category", () => {
    expect(categories.some((c) => c.name === "Autre")).toBe(true);
  });
});
