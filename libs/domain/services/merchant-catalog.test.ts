import { describe, expect, it } from "vitest";
import { compileRule, matchCategoryId, orderRules } from "./categorization";
import { compileMerchants, resolveMerchants, type MerchantEntry } from "./merchant-catalog";

const CATEGORY_IDS: Record<string, number> = {
  Alimentation: 1,
  Restaurants: 2,
  Transport: 3,
  Loisirs: 4,
  Apports: 5,
};
const byName = (name: string) => CATEGORY_IDS[name] ?? null;

const ENTRIES: MerchantEntry[] = [
  { key: "carrefour", name: "Carrefour", kind: "grocery", patterns: ["CARREFOUR"] },
  { key: "uber", name: "Uber", kind: "ride_hailing", patterns: ["UBER"] },
  { key: "uber-eats", name: "Uber Eats", kind: "food_delivery", patterns: ["UBER EATS"] },
  { key: "salary", name: "Salaire", kind: "income", patterns: ["SALAIRE"], amountCondition: "positive", priority: 50 },
  { key: "cinema", name: "Cinéma", kind: "culture", patterns: ["UGC", "CINEMA"] },
  // A kind whose category this install does not have.
  { key: "pharmacie", name: "Pharmacie", kind: "pharmacy", patterns: ["PHARMACIE"] },
];

const rulesFor = (overrides = [] as Parameters<typeof resolveMerchants>[2]) =>
  orderRules(compileMerchants(resolveMerchants(ENTRIES, byName, overrides)));

const categorize = (
  description: string,
  amountCents = -1000,
  overrides = [] as Parameters<typeof resolveMerchants>[2],
) => matchCategoryId(description, amountCents, rulesFor(overrides));

describe("resolveMerchants", () => {
  it("files an entry into the category its kind maps to", () => {
    const resolved = resolveMerchants(ENTRIES, byName, []);
    expect(resolved.find((m) => m.entry.key === "carrefour")).toMatchObject({
      categoryId: CATEGORY_IDS.Alimentation,
      disabled: false,
    });
  });

  it("leaves an entry uncategorised when its category does not exist here", () => {
    const resolved = resolveMerchants(ENTRIES, byName, []);
    expect(resolved.find((m) => m.entry.key === "pharmacie")?.categoryId).toBeNull();
    expect(categorize("PHARMACIE DU CENTRE")).toBeNull();
  });

  it("files an entry where its kind says, whatever the user switched off", () => {
    // Switching a merchant off is the only decision on offer, and it does not
    // move it: where it files stays the catalogue's to say, so a later
    // release can still correct the mapping.
    const resolved = resolveMerchants(ENTRIES, byName, [
      { merchantKey: "carrefour", disabled: true },
    ]);
    expect(resolved.find((m) => m.entry.key === "carrefour")).toMatchObject({
      categoryId: CATEGORY_IDS.Alimentation,
      disabled: true,
    });
  });
});

describe("compileMerchants", () => {
  it("emits one rule per pattern, so specificity is per pattern", () => {
    const compiled = compileMerchants(resolveMerchants(ENTRIES, byName, []));
    const cinema = compiled.filter((r) => r.origin === "merchant:cinema");
    expect(cinema.map((r) => r.specificity).sort()).toEqual([3, 6]);
  });

  it("marks its rules as shipped, not as yours", () => {
    expect(rulesFor().every((r) => r.source === "catalog")).toBe(true);
  });

  it("skips a disabled entry entirely", () => {
    const off = [{ merchantKey: "carrefour", categoryId: null, disabled: true }];
    expect(categorize("CARREFOUR MARKET LILLE")).toBe(CATEGORY_IDS.Alimentation);
    expect(categorize("CARREFOUR MARKET LILLE", -1000, off)).toBeNull();
  });

  it("honours an entry's amount condition", () => {
    expect(categorize("VIR SALAIRE MARS", 250000)).toBe(CATEGORY_IDS.Apports);
    expect(categorize("PRLV SALAIRE TROP PERCU", -250000)).toBeNull();
  });
});

describe("precedence", () => {
  it("gives the longer pattern the match: UBER EATS is dinner, UBER is a ride", () => {
    expect(categorize("CB UBER EATS 8004 AMSTERDAM")).toBe(CATEGORY_IDS.Restaurants);
    expect(categorize("CB UBER TRIP HELP UBER COM")).toBe(CATEGORY_IDS.Transport);
  });

  it("lets a rule you wrote beat the catalogue at the same priority", () => {
    const mine = compileRule({
      id: 7,
      categoryId: CATEGORY_IDS.Loisirs,
      pattern: "CARREFOUR",
      matchType: "contains",
      amountCondition: "any",
      priority: 100,
    })!;
    const ordered = orderRules([...rulesFor(), mine]);
    expect(matchCategoryId("CARREFOUR CITY", -1000, ordered)).toBe(CATEGORY_IDS.Loisirs);
    // Same pattern, same priority: yours is simply tried first.
    const carrefourRules = ordered.filter((r) => r.test("CARREFOUR CITY", -1000));
    expect(carrefourRules.map((r) => r.source)).toEqual(["user", "catalog"]);
  });

  it("still lets priority win over specificity — that is what priority is for", () => {
    const broad = compileRule({
      id: 8,
      categoryId: CATEGORY_IDS.Apports,
      pattern: "UBER",
      matchType: "contains",
      amountCondition: "any",
      priority: 10,
    })!;
    const ordered = orderRules([...rulesFor(), broad]);
    expect(matchCategoryId("CB UBER EATS 8004", -1000, ordered)).toBe(CATEGORY_IDS.Apports);
  });
});
