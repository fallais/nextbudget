import { describe, it, expect } from "vitest";
import { toComparables, type DvfRow } from "./dvf";

const row = (over: Partial<DvfRow>): DvfRow => ({
  id_mutation: "2024-1",
  date_mutation: "2024-03-01",
  nature_mutation: "Vente",
  valeur_fonciere: "300000",
  type_local: "Maison",
  surface_reelle_bati: "100",
  longitude: "1.39",
  latitude: "43.63",
  ...over,
});

describe("toComparables", () => {
  it("keeps a plain sale of one house", () => {
    const [c] = toComparables([row({})], "maison");
    expect(c).toMatchObject({ valueCents: 300_000_00, surfaceM2: 100 });
  });

  it("ignores anything that is not a sale", () => {
    // Adjudications and expropriations do not trade at market prices.
    expect(toComparables([row({ nature_mutation: "Adjudication" })], "maison")).toEqual([]);
  });

  it("ignores the other kind of property", () => {
    expect(toComparables([row({ type_local: "Appartement" })], "maison")).toEqual([]);
  });

  it("drops a sale of two houses at one price", () => {
    // One valeur_fonciere covering both: neither surface can be priced from it.
    const pair = [row({ id_mutation: "2024-9" }), row({ id_mutation: "2024-9" })];
    expect(toComparables(pair, "maison")).toEqual([]);
  });

  it("drops a house sold together with a flat", () => {
    const mixed = [
      row({ id_mutation: "2024-9" }),
      row({ id_mutation: "2024-9", type_local: "Appartement" }),
    ];
    expect(toComparables(mixed, "maison")).toEqual([]);
  });

  it("keeps a house sold with its garage and its land", () => {
    // The common case, and the price is still the house's: outbuildings and
    // parcels carry no surface_reelle_bati of their own.
    const withExtras = [
      row({ id_mutation: "2024-9" }),
      row({ id_mutation: "2024-9", type_local: "Dépendance", surface_reelle_bati: "" }),
      row({ id_mutation: "2024-9", type_local: "", surface_reelle_bati: "" }),
    ];
    expect(toComparables(withExtras, "maison")).toHaveLength(1);
  });

  it("skips rows with nothing to compute from", () => {
    expect(toComparables([row({ surface_reelle_bati: "" })], "maison")).toEqual([]);
    expect(toComparables([row({ valeur_fonciere: "" })], "maison")).toEqual([]);
    expect(toComparables([row({ latitude: "" })], "maison")).toEqual([]);
  });

  it("reads centimes without losing one", () => {
    const [c] = toComparables([row({ valeur_fonciere: "249999.99" })], "maison");
    expect(c.valueCents).toBe(249_999_99);
  });
});
