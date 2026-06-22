import { describe, it, expect } from "vitest";
import { compileRule, matchCategoryId, type CompiledRule } from "./core";

const base = { id: 1, categoryId: 10, amountCondition: "any", priority: 100 } as const;

describe("compileRule", () => {
  it("matches with 'contains'", () => {
    const r = compileRule({ ...base, pattern: "CARREFOUR", matchType: "contains" })!;
    expect(r).not.toBeNull();
    expect(r.test("ACHAT CARREFOUR MARKET", -1000)).toBe(true);
    expect(r.test("LECLERC", -1000)).toBe(false);
  });

  it("matches with 'starts_with'", () => {
    const r = compileRule({ ...base, pattern: "VIR", matchType: "starts_with" })!;
    expect(r.test("VIR SEPA SALAIRE", 1000)).toBe(true);
    expect(r.test("PRELEV VIR", 1000)).toBe(false);
  });

  it("matches with 'equals'", () => {
    const r = compileRule({ ...base, pattern: "EDF", matchType: "equals" })!;
    expect(r.test("EDF", -1000)).toBe(true);
    expect(r.test("EDF FACTURE", -1000)).toBe(false);
  });

  it("matches a word-boundary regex", () => {
    const r = compileRule({ ...base, pattern: "\\bASF\\b", matchType: "regex" })!;
    expect(r.test("PEAGE ASF A61", -500)).toBe(true);
    expect(r.test("ASFALL", -500)).toBe(false);
  });

  it("returns null for an invalid regex", () => {
    expect(compileRule({ ...base, pattern: "[", matchType: "regex" })).toBeNull();
  });

  it("respects amountCondition", () => {
    const pos = compileRule({ ...base, pattern: "VIR", matchType: "contains", amountCondition: "positive" })!;
    expect(pos.test("VIR", 100)).toBe(true);
    expect(pos.test("VIR", -100)).toBe(false);
    const neg = compileRule({ ...base, pattern: "VIR", matchType: "contains", amountCondition: "negative" })!;
    expect(neg.test("VIR", -100)).toBe(true);
    expect(neg.test("VIR", 100)).toBe(false);
  });
});

describe("matchCategoryId", () => {
  it("returns the first matching rule's category (array order wins)", () => {
    const rules: CompiledRule[] = [
      compileRule({ ...base, categoryId: 1, pattern: "CARREFOUR", matchType: "contains" })!,
      compileRule({ ...base, categoryId: 2, pattern: "MARKET", matchType: "contains" })!,
    ];
    expect(matchCategoryId("CARREFOUR MARKET", -1, rules)).toBe(1);
    expect(matchCategoryId("SUPER MARKET", -1, rules)).toBe(2);
    expect(matchCategoryId("INCONNU", -1, rules)).toBeNull();
  });
});
