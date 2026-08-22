import { describe, expect, it } from "vitest";
import { LIFE } from "./life";
import { categoryOf, expectCategoriesExist, expectWellFormed, matchedEntry } from "./testing";

describe("life catalogue", () => {
  it("is well formed", () => expectWellFormed(LIFE));
  it("files into categories a fresh install has", () => expectCategoriesExist(LIFE));

  it.each([
    ["CB PHARMACIE DE LA GARE", "Santé"],
    ["CB DOCTOLIB SAS", "Santé"],
    ["VIR CPAM DU NORD", "Santé"],
    ["CB CABINET DENTAIRE LILLE", "Santé"],
    ["CB KRYS OPTICIEN", "Santé"],
    ["PRLV NETFLIX COM", "Loisirs"],
    ["PRLV SPOTIFY AB", "Loisirs"],
    ["PRLV CANAL+ SA", "Loisirs"],
    ["CB UGC CINE CITE", "Loisirs"],
    ["CB DECATHLON 3355", "Sport"],
    ["PRLV BASIC FIT FRANCE", "Sport"],
    ["CB AIRBNB PAYMENTS", "Loisirs"],
    ["CB HOTEL IBIS LILLE", "Loisirs"],
    ["CB STEAM GAMES", "Loisirs"],
    ["CB CULTURA VILLENEUVE", "Loisirs"],
  ])("%s → %s", (line, expected) => {
    expect(categoryOf(line)).toBe(expected);
  });

  it("reads L'ORANGE BLEUE as the gym and ORANGE as the operator", () => {
    expect(matchedEntry("PRLV L ORANGE BLEUE ARRAS")).toBe("merchant:orange-bleue");
    expect(matchedEntry("PRLV ORANGE SA")).toBe("merchant:orange");
  });

  it("separates the Apple shop from the Apple subscription", () => {
    expect(categoryOf("CB APPLE STORE PARIS")).toBe("Shopping");
    expect(categoryOf("PRLV APPLE MUSIC")).toBe("Loisirs");
  });

  it("does not treat a parapharmacy as an unknown", () => {
    expect(matchedEntry("CB PARAPHARMACIE LECLERC")).toBe("merchant:pharmacie");
  });
});
