import { describe, expect, it } from "vitest";
import { SHOPPING } from "./shopping";
import { categoryOf, expectCategoriesExist, expectWellFormed, matchedEntry } from "./testing";

describe("shopping catalogue", () => {
  it("is well formed", () => expectWellFormed(SHOPPING));
  it("files into categories a fresh install has", () => expectCategoriesExist(SHOPPING));

  it.each([
    ["CB AMAZON EU SARL", "Shopping"],
    ["CB CDISCOUNT BORDEAUX", "Shopping"],
    ["CB VINTED", "Shopping"],
    ["CB ZALANDO SE", "Shopping"],
    ["CB KIABI 1123 LENS", "Shopping"],
    ["CB FNAC LILLE", "Shopping"],
    ["CB DARTY VILLENEUVE", "Shopping"],
    ["CB IKEA LOMME", "Shopping"],
    ["CB GIFI ARRAS", "Shopping"],
    ["CB LEROY MERLIN LOMME", "Travaux"],
    ["CB CASTORAMA ENGLOS", "Travaux"],
    ["CB BRICO DEPOT DOUAI", "Travaux"],
    ["CB GAMM VERT BAPAUME", "Animaux & Jardin"],
    ["CB MAXI ZOO LILLE", "Animaux & Jardin"],
    ["CB CLINIQUE VETERINAIRE", "Animaux & Jardin"],
  ])("%s → %s", (line, expected) => {
    expect(categoryOf(line)).toBe(expected);
  });

  it("keeps BUT and FLY inside word boundaries", () => {
    expect(matchedEntry("CB BUT DOUAI")).toBe("merchant:but");
    expect(categoryOf("PRLV ATTRIBUTION MENSUELLE")).toBeNull();
    expect(matchedEntry("CB FLY MEUBLES LENS")).toBe("merchant:fly");
    expect(matchedEntry("CB FLYING TIGER COPENHAGEN")).toBe("merchant:flying-tiger");
  });

  it("separates the Amazon marketplace from its video subscription", () => {
    expect(categoryOf("CB AMAZON MKTPLACE EU")).toBe("Shopping");
    expect(categoryOf("CB AMAZON PRIME VIDEO")).toBe("Loisirs");
  });

  it("does not take the word ACTION for the shop", () => {
    expect(matchedEntry("CB MAGASIN ACTION LENS")).toBe("merchant:action");
    expect(categoryOf("PRLV ACTION SOCIALE CE")).toBeNull();
  });
});
