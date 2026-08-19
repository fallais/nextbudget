import { describe, expect, it } from "vitest";
import { HOME } from "./home";
import { categoryOf, expectCategoriesExist, expectWellFormed, matchedEntry } from "./testing";

describe("home catalogue", () => {
  it("is well formed", () => expectWellFormed(HOME));
  it("files into categories a fresh install has", () => expectCategoriesExist(HOME));

  it.each([
    ["VIR SEPA LOYER APPARTEMENT", "Logement"],
    ["PRLV FONCIA CHARGES", "Logement"],
    ["PRLV SEPA ECH PRET IMMOBILIER", "Logement"],
    ["PRLV SEPA EDF CLIENTS PARTICULIERS", "Énergie"],
    ["PRLV ENGIE GAZ", "Énergie"],
    ["PRLV VEOLIA EAU", "Énergie"],
    ["PRLV SEPA FREE MOBILE 12345", "Télécom"],
    ["PRLV SFR FIBRE", "Télécom"],
    ["PRLV BOUYGUES TELECOM", "Télécom"],
    ["PRLV SEPA MAIF ASSURANCES", "Assurances"],
    ["PRLV AXA FRANCE VIE", "Assurances"],
    ["PRLV HARMONIE MUTUELLE", "Assurances"],
  ])("%s → %s", (line, expected) => {
    expect(categoryOf(line)).toBe(expected);
  });

  it("keeps ENI inside word boundaries", () => {
    expect(matchedEntry("PRLV ENI GAS POWER")).toBe("merchant:eni");
    expect(categoryOf("CB MENISCUS SARL")).toBeNull();
  });

  it("reads Sosh and RED as their own brands, not as their parents", () => {
    expect(matchedEntry("PRLV SOSH MOBILE")).toBe("merchant:sosh");
    expect(matchedEntry("PRLV RED BY SFR")).toBe("merchant:red-by-sfr");
  });

  it("sends a mutuelle to insurance, where the premium is actually paid", () => {
    expect(categoryOf("PRLV MUTUELLE GENERALE")).toBe("Assurances");
  });
});
