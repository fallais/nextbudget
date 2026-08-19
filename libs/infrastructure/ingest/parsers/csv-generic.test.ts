import { describe, expect, it } from "vitest";
import { parseCsv, previewCsv } from "./csv-generic";

const SIGNED = [
  "Date;Libellé;Montant",
  "15/05/2026;CARREFOUR MARKET;-42,50",
  "16/05/2026;VIREMENT SALAIRE;2 500,00",
].join("\n");

const PAIR = [
  "Date operation;Intitulé;Débit;Crédit",
  "15/05/2026;CARREFOUR;42,50;",
  "16/05/2026;SALAIRE;;2500,00",
].join("\n");

describe("parseCsv detection", () => {
  it("reads a signed amount column", () => {
    const result = parseCsv(SIGNED);
    expect(result.errors).toEqual([]);
    expect(result.mapping).toMatchObject({
      delimiter: ";",
      date: "Date",
      description: "Libellé",
      amount: "Montant",
    });
    expect(result.rows.map((r) => [r.date, r.amountCents])).toEqual([
      ["2026-05-15", -4250],
      ["2026-05-16", 250000],
    ]);
  });

  it("reads a débit/crédit pair as one signed amount", () => {
    const result = parseCsv(PAIR);
    expect(result.mapping.amount).toBeNull();
    expect(result.rows.map((r) => r.amountCents)).toEqual([-4250, 250000]);
  });

  it("skips the bank's preamble above the header row", () => {
    const withPreamble = ["Relevé de compte 12345", "Édité le 01/06/2026", "", SIGNED].join("\n");
    const result = parseCsv(withPreamble);
    expect(result.mapping.headerRowIndex).toBe(3);
    expect(result.rows).toHaveLength(2);
  });

  it("reads a pipe-delimited export, leaving only the date to be named", () => {
    const piped = [
      "Jour|Operation|Sortie|Entree",
      "15/05/2026|BOULANGERIE|4,20|",
      "16/05/2026|REMBOURSEMENT||30,00",
    ].join("\n");

    const result = parseCsv(piped);
    expect(result.mapping).toMatchObject({
      delimiter: "|",
      date: "Jour",
      description: "Operation",
      debit: "Sortie",
      credit: "Entree",
    });
    expect(result.rows.map((r) => r.amountCents)).toEqual([-420, 3000]);
  });

  it("reports every column it could not find, and imports nothing", () => {
    const result = parseCsv("Col A;Col B\nx;y");
    expect(result.rows).toEqual([]);
    expect(result.errors.map((e) => e.message)).toEqual([
      "Colonne de date introuvable",
      "Colonne de libellé introuvable",
      "Colonne(s) de montant introuvable(s)",
    ]);
  });
});

describe("parseCsv overrides", () => {
  const AMBIGUOUS = [
    "Date;Date valeur;Libellé;Montant;Montant devise",
    "15/05/2026;16/05/2026;CARREFOUR;-42,50;-42,50",
  ].join("\n");

  it("takes the column the caller names over the one detection picked", () => {
    const detected = parseCsv(AMBIGUOUS);
    expect(detected.mapping.date).toBe("Date");

    const overridden = parseCsv(AMBIGUOUS, { date: "Date valeur" });
    expect(overridden.mapping.date).toBe("Date valeur");
    expect(overridden.rows[0].date).toBe("2026-05-16");
  });

  it("falls back to detection when the named column is not in the file", () => {
    // A mapping kept from last month's export, whose columns since changed.
    const result = parseCsv(SIGNED, { date: "Date comptable" });
    expect(result.mapping.date).toBe("");
    expect(result.errors[0].message).toBe("Colonne de date introuvable");
  });

  it("inverts the sign for exports that state expenses as positive", () => {
    const result = parseCsv(SIGNED, { invertSign: true });
    expect(result.rows.map((r) => r.amountCents)).toEqual([4250, -250000]);
  });

  it("pins the date format, so an ambiguous day/month cannot flip", () => {
    const ambiguousDay = "Date;Libellé;Montant\n03/04/2026;CARREFOUR;-10,00";
    expect(parseCsv(ambiguousDay, { dateFormat: "dd/MM/yyyy" }).rows[0].date).toBe("2026-04-03");
    expect(parseCsv(ambiguousDay, { dateFormat: "MM/dd/yyyy" }).rows[0].date).toBe("2026-03-04");
  });

  it("re-detects the columns when only the delimiter is given", () => {
    // Changing the delimiter changes the headers, so the column names the
    // caller did not send have to be found again rather than kept.
    const commas = ["Date,Description,Amount", "15/05/2026,CARREFOUR MARKET,-42.50"].join("\n");
    const result = parseCsv(commas, { delimiter: "," });
    expect(result.mapping).toMatchObject({
      delimiter: ",",
      date: "Date",
      description: "Description",
      amount: "Amount",
    });
    expect(result.rows[0].amountCents).toBe(-4250);
  });
});

describe("previewCsv", () => {
  it("counts the whole file but returns only a sample", () => {
    const many = [
      "Date;Libellé;Montant",
      ...Array.from({ length: 20 }, (_, i) => `0${(i % 9) + 1}/05/2026;ACHAT ${i};-1,00`),
    ].join("\n");

    const preview = previewCsv(many, {}, 5);
    expect(preview.rowsTotal).toBe(20);
    expect(preview.rowsError).toBe(0);
    expect(preview.sample).toHaveLength(5);
    expect(preview.headers).toEqual(["Date", "Libellé", "Montant"]);
    expect(preview.missing).toEqual([]);
  });

  it("counts unreadable rows without letting them stop the read", () => {
    const mixed = [
      "Date;Libellé;Montant",
      "15/05/2026;CARREFOUR;-42,50",
      "pas une date;CARREFOUR;-1,00",
      "17/05/2026;;-1,00",
    ].join("\n");

    const preview = previewCsv(mixed);
    expect(preview.rowsTotal).toBe(3);
    expect(preview.rowsError).toBe(2);
    expect(preview.sample).toHaveLength(1);
    expect(preview.errors[0]).toMatchObject({ row: 3 });
  });

  it("still returns the headers when nothing was recognised, so it can be fixed", () => {
    const preview = previewCsv("Col A;Col B\nx;y");
    expect(preview.headers).toEqual(["Col A", "Col B"]);
    expect(preview.missing).toEqual(["date", "description", "amount"]);
    expect(preview.sample).toEqual([]);
  });
});
