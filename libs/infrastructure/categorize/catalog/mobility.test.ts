import { describe, expect, it } from "vitest";
import { MOBILITY } from "./mobility";
import { categoryOf, expectCategoriesExist, expectWellFormed, matchedEntry } from "./testing";

describe("mobility catalogue", () => {
  it("is well formed", () => expectWellFormed(MOBILITY));
  it("files into categories a fresh install has", () => expectCategoriesExist(MOBILITY));

  it.each([
    ["CB SNCF INTERNET PARIS", "Transport"],
    ["CB OUIGO 8712", "Transport"],
    ["CB RATP NAVIGO PARIS", "Transport"],
    ["CB BLABLACAR PARIS", "Transport"],
    ["CB TOTALENERGIES ACCESS 6612", "Transport"],
    ["CB STATION SHELL A1", "Transport"],
    ["CB VINCI AUTOROUTES", "Transport"],
    ["PRLV ULYS TELEPEAGE", "Transport"],
    ["CB PARKING INDIGO LILLE", "Transport"],
    ["CB AIR FRANCE 057", "Transport"],
    ["CB NORAUTO LOMME", "Transport"],
    ["CB EUROPCAR LILLE GARE", "Transport"],
    ["CB TAXI G7 PARIS", "Transport"],
  ])("%s → %s", (line, expected) => {
    expect(categoryOf(line)).toBe(expected);
  });

  it("does not read the word TOTAL on a statement as the fuel brand", () => {
    expect(categoryOf("TOTAL DES OPERATIONS DU MOIS")).toBeNull();
    expect(matchedEntry("CB TOTALENERGIES 4471")).toBe("merchant:totalenergies");
  });

  it("sends TotalEnergies electricity to energy, not to the pump", () => {
    expect(categoryOf("PRLV SEPA TOTALENERGIES ELECTRICITE")).toBe("Énergie");
    expect(categoryOf("CB TOTALENERGIES ACCESS")).toBe("Transport");
  });

  it("keeps three-letter road operators inside word boundaries", () => {
    expect(matchedEntry("CB ASF PEAGE A9")).toBe("merchant:asf");
    expect(categoryOf("CB BASF FRANCE")).toBeNull();
    expect(matchedEntry("CB BP STATION LILLE")).toBe("merchant:bp");
    expect(categoryOf("VIR SEPA BPCE SERVICES", -1000)).toBeNull();
  });

  it("does not claim AVIS, which French statements use for notices", () => {
    expect(categoryOf("AVIS D ECHEANCE ASSURANCE")).not.toBe("Transport");
  });
});
