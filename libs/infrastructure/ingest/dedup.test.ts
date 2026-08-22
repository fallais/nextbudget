import { describe, it, expect } from "vitest";
import { fingerprintKey, planImport, type Fingerprintable } from "./dedup";

const row = (date: string, amountCents: number, normalizedDescription: string): Fingerprintable => ({
  date,
  amountCents,
  normalizedDescription,
});

const TICKET = row("2026-05-03", -190, "RATP");
const COURSES = row("2026-05-03", -4235, "CARREFOUR MARKET");

describe("fingerprintKey", () => {
  it("is the triple a bank statement cannot tell rows apart by", () => {
    expect(fingerprintKey(TICKET)).toBe("2026-05-03|-190|RATP");
  });

  it("separates rows differing in any one of the three", () => {
    const keys = [
      fingerprintKey(TICKET),
      fingerprintKey({ ...TICKET, date: "2026-05-04" }),
      fingerprintKey({ ...TICKET, amountCents: -200 }),
      fingerprintKey({ ...TICKET, normalizedDescription: "SNCF" }),
    ];
    expect(new Set(keys).size).toBe(4);
  });
});

describe("planImport", () => {
  it("writes every row of a first import", () => {
    const plan = planImport([TICKET, COURSES], new Map());
    expect(plan.write.map((w) => w.occurrence)).toEqual([0, 0]);
    expect(plan.duplicates).toBe(0);
  });

  it("keeps genuine same-day repeats — the whole point", () => {
    // Two metro tickets bought the same day: one date, one amount, one
    // libellé, two real transactions.
    const plan = planImport([TICKET, TICKET, TICKET], new Map());
    expect(plan.write.map((w) => w.occurrence)).toEqual([0, 1, 2]);
    expect(plan.duplicates).toBe(0);
  });

  it("writes nothing when the same file is imported twice", () => {
    const existing = new Map([[fingerprintKey(TICKET), 2]]);
    const plan = planImport([TICKET, TICKET], existing);
    expect(plan.write).toEqual([]);
    expect(plan.duplicates).toBe(2);
  });

  it("reconciles to the higher count instead of doubling it", () => {
    // The account holds one; the file says there were three. It is short two,
    // and they are the 1st and 2nd occurrences.
    const existing = new Map([[fingerprintKey(TICKET), 1]]);
    const plan = planImport([TICKET, TICKET, TICKET], existing);
    expect(plan.write.map((w) => w.occurrence)).toEqual([1, 2]);
    expect(plan.duplicates).toBe(1);
  });

  it("heals a row an older version dropped as a lookalike", () => {
    // What the previous fingerprint did to two identical lines: kept one.
    // Re-importing the same file now writes the one it swallowed, and only it.
    const afterOldImport = new Map([[fingerprintKey(TICKET), 1]]);
    const plan = planImport([TICKET, TICKET], afterOldImport);
    expect(plan.write.map((w) => w.occurrence)).toEqual([1]);
    expect(plan.duplicates).toBe(1);
  });

  it("counts occurrences per fingerprint, not per file", () => {
    const existing = new Map([[fingerprintKey(COURSES), 1]]);
    const plan = planImport([TICKET, COURSES, TICKET, COURSES], existing);
    expect(plan.write.map((w) => [w.row.normalizedDescription, w.occurrence])).toEqual([
      ["RATP", 0],
      ["RATP", 1],
      ["CARREFOUR MARKET", 1],
    ]);
    expect(plan.duplicates).toBe(1);
  });

  it("preserves file order, so occurrences follow the statement", () => {
    const plan = planImport([COURSES, TICKET, COURSES], new Map());
    expect(plan.write.map((w) => w.row.normalizedDescription)).toEqual([
      "CARREFOUR MARKET",
      "RATP",
      "CARREFOUR MARKET",
    ]);
  });

  it("handles an empty file", () => {
    expect(planImport([], new Map())).toEqual({ write: [], duplicates: 0 });
  });
});
