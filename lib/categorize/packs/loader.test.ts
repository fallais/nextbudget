import { describe, it, expect } from "vitest";
import { loadCorePacks, compilePackRules } from "./loader";

describe("core pattern packs", () => {
  it("loads the core-fr pack with categories and rules", () => {
    const packs = loadCorePacks();
    expect(packs.length).toBeGreaterThan(0);
    const fr = packs.find((p) => p.name === "core-fr");
    expect(fr).toBeDefined();
    const alimentation = fr!.categories.find((c) => c.name === "Alimentation");
    expect(alimentation?.rules.some((r) => r.pattern === "CARREFOUR")).toBe(true);
  });

  it("compilePackRules maps categories by name and skips unknown ones", () => {
    const packs = loadCorePacks();
    const compiled = compilePackRules(packs, new Map([["Alimentation", 1]]));
    expect(compiled.length).toBeGreaterThan(0);
    // Only the mapped category is compiled; everything else is skipped.
    expect(compiled.every((r) => r.categoryId === 1)).toBe(true);
  });

  it("compiles nothing when no category names match", () => {
    const packs = loadCorePacks();
    expect(compilePackRules(packs, new Map()).length).toBe(0);
  });
});
