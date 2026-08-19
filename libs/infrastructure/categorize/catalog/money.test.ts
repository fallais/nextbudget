import { describe, expect, it } from "vitest";
import { MONEY } from "./money";
import { categoryOf, expectCategoriesExist, expectWellFormed, matchedEntry } from "./testing";

describe("money catalogue", () => {
  it("is well formed", () => expectWellFormed(MONEY));
  it("files into categories a fresh install has", () => expectCategoriesExist(MONEY));

  it.each([
    ["FRAIS BANCAIRES TRIMESTRIELS", "Banque"],
    ["COTISATION CARTE VISA", "Banque"],
    ["AGIOS DU MOIS", "Banque"],
    ["PRLV DGFIP IMPOT SUR LE REVENU", "Impôts"],
    ["PRLV TAXE FONCIERE 2026", "Impôts"],
    ["CB ANTAI AMENDE", "Impôts"],
    ["VIR LIVRET A VERS COMPTE", "Épargne"],
    ["RET DAB 12/05 18H23 LILLE", "Retrait"],
    ["RETRAIT ESPECES DAB 004", "Retrait"],
  ])("%s → %s", (line, expected) => {
    expect(categoryOf(line)).toBe(expected);
  });

  it.each([
    ["VIR SEPA SALAIRE MARS 2026", "Apports"],
    ["VIR FRANCE TRAVAIL ALLOCATION", "Apports"],
    ["VIR URSSAF REMB COTISATIONS", "Apports"],
    ["REM CHQ 004512", "Apports"],
    ["VIR M DUPONT REMBOURSEMENT", "Apports"],
    ["VIREMENT DE MME MARTIN", "Apports"],
  ])("%s (credit) → %s", (line, expected) => {
    expect(categoryOf(line, 250000)).toBe(expected);
  });

  it("only reads a generic incoming transfer when money actually came in", () => {
    expect(categoryOf("VIR SEPA M DURAND", 120000)).toBe("Apports");
    expect(categoryOf("VIR SEPA M DURAND", -120000)).toBeNull();
  });

  it("keeps a named merchant ahead of the generic transfer wording", () => {
    expect(matchedEntry("VIR SEPA URSSAF REMB", 40000)).toBe("merchant:urssaf-refund");
    expect(matchedEntry("VIR SEPA SALAIRE FEVRIER", 250000)).toBe("merchant:salary");
  });

  it("reads loan interest as a cost, never as an incoming apport", () => {
    expect(categoryOf("INTERETS CREDIT IMMOBILIER", -12000)).toBe("Banque");
    expect(categoryOf("VIR INTERETS CREDIT MUTUEL", 12000)).toBe("Apports");
  });

  it("does not claim a line it knows nothing about", () => {
    expect(categoryOf("CB SARL LE PETIT COIN 4471")).toBeNull();
  });
});
