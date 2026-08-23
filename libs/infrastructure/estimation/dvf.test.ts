import { describe, it, expect } from "vitest";
import { residentialLandM2, toComparables, toLandPricesCents, type DvfRow } from "./dvf";

const row = (over: Partial<DvfRow>): DvfRow => ({
  id_mutation: "2024-1",
  date_mutation: "2024-03-01",
  nature_mutation: "Vente",
  valeur_fonciere: "300000",
  id_parcelle: "31149000AB0001",
  type_local: "Maison",
  surface_reelle_bati: "100",
  code_nature_culture: "S",
  surface_terrain: "",
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

  it("reads the plot the house sits on", () => {
    const [c] = toComparables([row({ surface_terrain: "640" })], "maison");
    expect(c.landM2).toBe(640);
  });

  it("has no plot to report when the sale recorded none", () => {
    expect(toComparables([row({})], "maison")[0].landM2).toBe(0);
  });
});

describe("residentialLandM2", () => {
  it("counts a parcel once however many buildings stand on it", () => {
    // DVF repeats the parcel's area on every local: house, garage, shed. Summing
    // the column would treble a plot that is one plot.
    const group = [
      row({ surface_terrain: "1217" }),
      row({ type_local: "Dépendance", surface_reelle_bati: "", surface_terrain: "1217" }),
      row({ type_local: "Dépendance", surface_reelle_bati: "", surface_terrain: "1217" }),
    ];
    expect(residentialLandM2(group)).toBe(1217);
  });

  it("adds up the several parcels one sale can cover", () => {
    const group = [
      row({ surface_terrain: "1217" }),
      row({ id_parcelle: "31149000AB0002", type_local: "", surface_terrain: "176" }),
      row({ id_parcelle: "31149000AB0003", type_local: "", surface_terrain: "93" }),
    ];
    expect(residentialLandM2(group)).toBe(1486);
  });

  it("leaves out farmland, which is not a garden", () => {
    // Prés and terres go for a euro or two the m² against several hundred for
    // building land. Counting them in would value a smallholding as a plot.
    const group = [
      row({ surface_terrain: "1217" }),
      row({ id_parcelle: "31149000AB0009", type_local: "", code_nature_culture: "P", surface_terrain: "902" }),
      row({ id_parcelle: "31149000AB0010", type_local: "", code_nature_culture: "T", surface_terrain: "949" }),
    ];
    expect(residentialLandM2(group)).toBe(1217);
  });
});

describe("toLandPricesCents", () => {
  const plot = (over: Partial<DvfRow>): DvfRow =>
    row({ type_local: "", surface_reelle_bati: "", surface_terrain: "500", ...over });

  it("prices a bare plot by the m²", () => {
    expect(toLandPricesCents([plot({ valeur_fonciere: "100000" })])).toEqual([200_00]);
  });

  it("ignores a sale that had a building on it", () => {
    expect(toLandPricesCents([row({ surface_terrain: "500" })])).toEqual([]);
  });

  it("ignores the one-euro transfers DVF files as sales", () => {
    // Donations, boundary corrections and sales within a family. There are as
    // many of them as there are real plot sales, and they price at nothing.
    expect(toLandPricesCents([plot({ valeur_fonciere: "1" })])).toEqual([]);
  });

  it("ignores a plot sold with farmland attached", () => {
    // The average would describe neither market.
    const mixed = [
      plot({ id_mutation: "2024-7" }),
      plot({ id_mutation: "2024-7", id_parcelle: "31149000AB0044", code_nature_culture: "T" }),
    ];
    expect(toLandPricesCents(mixed)).toEqual([]);
  });
});