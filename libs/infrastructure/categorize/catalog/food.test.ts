import { describe, expect, it } from "vitest";
import { FOOD } from "./food";
import { categoryOf, expectCategoriesExist, expectWellFormed, matchedEntry } from "./testing";

describe("food catalogue", () => {
  it("is well formed", () => expectWellFormed(FOOD));
  it("files into categories a fresh install has", () => expectCategoriesExist(FOOD));

  it.each([
    ["CB CARREFOUR MARKET 4552 LILLE", "Alimentation"],
    ["PAIEMENT CB LIDL 2011 ARRAS", "Alimentation"],
    ["CB E LECLERC DRIVE ORCHIES", "Alimentation"],
    ["CB INTERMARCHE SUPER 6721", "Alimentation"],
    ["CB PICARD SURGELES 118", "Alimentation"],
    ["CB BOULANGERIE DUPONT", "Alimentation"],
    ["CB MARIE BLACHERE ARRAS", "Alimentation"],
    ["CB MCDONALDS 1234 PARIS 15", "Restaurants"],
    ["CB BURGER KING LILLE", "Restaurants"],
    ["CB O TACOS DOUAI", "Restaurants"],
    ["CB BUFFALO GRILL ENGLOS", "Restaurants"],
    ["CB UBER EATS 8004 AMSTERDAM", "Restaurants"],
    ["CB DELIVEROO PARIS", "Restaurants"],
    ["CB STARBUCKS COFFEE 33", "Restaurants"],
    ["CB LE PETIT RESTAURANT DU COIN", "Restaurants"],
  ])("%s → %s", (line, expected) => {
    expect(categoryOf(line)).toBe(expected);
  });

  it("reads SUPER U and its stations as the same chain", () => {
    expect(matchedEntry("CB SUPER U LOMME")).toBe("merchant:super-u");
    expect(matchedEntry("CB STATION U ARRAS")).toBe("merchant:super-u");
  });

  it("does not take CASINO for a supermarket unless the label says so", () => {
    expect(matchedEntry("CB GEANT CASINO ANNECY")).toBe("merchant:casino");
    expect(categoryOf("CB CASINO BARRIERE LILLE")).toBeNull();
  });

  it("keeps CORA off the SNCF's CORAIL trains", () => {
    expect(matchedEntry("CB CORA DOUAI")).toBe("merchant:cora");
    expect(matchedEntry("CB SNCF CORAIL INTERCITES")).toBe("merchant:sncf");
  });

  it("prefers the delivery app to the ride: UBER EATS is dinner", () => {
    expect(matchedEntry("CB UBER EATS 8004")).toBe("merchant:uber-eats");
    expect(matchedEntry("CB UBER TRIP 8004")).toBe("merchant:uber");
  });
});
