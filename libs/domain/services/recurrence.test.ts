import { describe, it, expect } from "vitest";
import {
  amountDrift,
  detectRecurrence,
  hasPredictableAmount,
  monthlyCostCents,
  suggestedTolerancePct,
  suggestPattern,
  nextOccurrences,
  recurrenceKey,
  yearOnYear,
  type Occurrence,
} from "./recurrence";
import { normalizeDescription } from "@domain/value-objects/normalized-description";

/** Monthly charges on `day`, `count` of them, starting at `startMonth`. */
function monthly(startMonth: string, count: number, cents: number, day = 5): Occurrence[] {
  const [y, m] = startMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 + i, day));
    return { date: date.toISOString().slice(0, 10), amountCents: cents };
  });
}

describe("naming what is being charged", () => {
  it("keeps the merchant and drops the bank's own vocabulary", () => {
    expect(recurrenceKey(normalizeDescription("PRLV SEPA EDF 4837291"))).toBe("edf");
    expect(recurrenceKey(normalizeDescription("PRELEVEMENT SEPA VEOLIA EAU 12345678"))).toBe(
      "veolia eau",
    );
  });

  it("gives two references of the same charge one name", () => {
    // Otherwise every direct debit is its own merchant and nothing ever
    // repeats: the reference is different every month by design.
    const a = recurrenceKey(normalizeDescription("PRLV SEPA EDF 4837291"));
    const b = recurrenceKey(normalizeDescription("PRLV SEPA EDF 5012884"));
    expect(a).toBe(b);
  });

  it("does not let a month name split a standing order into twelve", () => {
    expect(recurrenceKey(normalizeDescription("VIR SEPA LOYER MARS"))).toBe(
      recurrenceKey(normalizeDescription("VIR SEPA LOYER AVRIL")),
    );
  });

  it("survives a card label with its date in it", () => {
    expect(recurrenceKey(normalizeDescription("CARTE 03/05 NETFLIX.COM"))).toBe("netflix.com");
    expect(recurrenceKey(normalizeDescription("CARTE 12/06 NETFLIX.COM"))).toBe("netflix.com");
  });

  it("has nothing to say about a label that is only a reference", () => {
    expect(recurrenceKey(normalizeDescription("PRLV 4837291"))).toBeNull();
  });
});

describe("deciding whether a charge repeats", () => {
  it("recognises a monthly direct debit", () => {
    const r = detectRecurrence(monthly("2026-01", 6, -1_549));
    expect(r?.cadence).toBe("monthly");
    expect(r?.occurrences).toBe(6);
    expect(r?.dueDay).toBe(5);
    expect(r?.medianAmountCents).toBe(1_549);
  });

  it("says nothing about a merchant you simply visit often", () => {
    // Four coffees in a fortnight is not a subscription, and offering to turn
    // it into one is how a suggestions list stops being read.
    expect(
      detectRecurrence([
        { date: "2026-03-02", amountCents: -450 },
        { date: "2026-03-05", amountCents: -450 },
        { date: "2026-03-09", amountCents: -450 },
        { date: "2026-03-14", amountCents: -450 },
      ]),
    ).toBeNull();
  });

  it("needs the gaps to agree, not just their middle", () => {
    // One 30-day gap between two wild ones has a perfectly monthly median.
    expect(
      detectRecurrence([
        { date: "2026-01-05", amountCents: -1_000 },
        { date: "2026-01-12", amountCents: -1_000 },
        { date: "2026-02-11", amountCents: -1_000 },
        { date: "2026-06-30", amountCents: -1_000 },
      ]),
    ).toBeNull();
  });

  it("does not need a steady amount, because EDF does not have one", () => {
    const varying = monthly("2026-01", 5, 0).map((o, i) => ({
      ...o,
      amountCents: [-8_900, -13_400, -7_600, -15_200, -9_100][i],
    }));
    expect(detectRecurrence(varying)?.cadence).toBe("monthly");
  });

  it("tells a quarterly water bill from a monthly one", () => {
    const r = detectRecurrence([
      { date: "2025-09-15", amountCents: -4_200 },
      { date: "2025-12-16", amountCents: -4_450 },
      { date: "2026-03-14", amountCents: -5_100 },
    ]);
    expect(r?.cadence).toBe("quarterly");
  });

  it("accepts a yearly premium on two occurrences, having no third to wait for", () => {
    const r = detectRecurrence([
      { date: "2025-04-02", amountCents: -21_800 },
      { date: "2026-04-01", amountCents: -23_400 },
    ]);
    expect(r?.cadence).toBe("yearly");
    expect(r?.nextDate).toBe("2027-04-01");
  });

  it("refuses a monthly claim on two occurrences", () => {
    expect(detectRecurrence(monthly("2026-01", 2, -1_000))).toBeNull();
  });

  it("keeps the day of the month when the next one falls in a short month", () => {
    const r = detectRecurrence([
      { date: "2025-12-31", amountCents: -1_000 },
      { date: "2026-01-31", amountCents: -1_000 },
      { date: "2026-02-28", amountCents: -1_000 },
    ]);
    expect(r?.nextDate).toBe("2026-03-28");
  });

  it("reads the same whatever order the rows arrive in", () => {
    const rows = monthly("2026-01", 5, -2_000);
    expect(detectRecurrence([...rows].reverse())).toEqual(detectRecurrence(rows));
  });
});

describe("what a projection asks for", () => {
  it("counts a monthly charge once and a weekly one every week", () => {
    const monthlyOne = { cadence: "monthly" as const, nextDate: "2026-09-05" };
    expect(nextOccurrences(monthlyOne, "2026-08-23", "2026-09-30")).toEqual(["2026-09-05"]);

    const weekly = { cadence: "weekly" as const, nextDate: "2026-08-24" };
    expect(nextOccurrences(weekly, "2026-08-23", "2026-09-15")).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("skips a due date that has already gone by", () => {
    const overdue = { cadence: "monthly" as const, nextDate: "2026-07-05" };
    expect(nextOccurrences(overdue, "2026-08-23", "2026-09-30")).toEqual(["2026-09-05"]);
  });
});

describe("whether the price has moved", () => {
  it("reports a subscription that went up, and when", () => {
    const drift = amountDrift([
      { date: "2026-01-03", amountCents: -1_349 },
      { date: "2026-02-03", amountCents: -1_349 },
      { date: "2026-03-03", amountCents: -1_349 },
      { date: "2026-04-03", amountCents: -1_599 },
      { date: "2026-05-03", amountCents: -1_599 },
      { date: "2026-06-03", amountCents: -1_599 },
    ]);
    expect(drift).toMatchObject({ fromCents: 1_349, toCents: 1_599, since: "2026-04-03" });
    expect(drift?.changePct).toBeCloseTo(18.5, 1);
  });

  it("ignores one estimated meter reading", () => {
    // A single spike is not a price rise, and reporting it as one would train
    // people to ignore the badge.
    expect(
      amountDrift([
        { date: "2026-01-03", amountCents: -8_900 },
        { date: "2026-02-03", amountCents: -9_100 },
        { date: "2026-03-03", amountCents: -22_000 },
        { date: "2026-04-03", amountCents: -8_800 },
        { date: "2026-05-03", amountCents: -9_000 },
        { date: "2026-06-03", amountCents: -8_950 },
      ]),
    ).toBeNull();
  });

  it("says nothing about a few centimes", () => {
    expect(
      amountDrift([
        { date: "2026-01-03", amountCents: -1_000 },
        { date: "2026-02-03", amountCents: -1_000 },
        { date: "2026-03-03", amountCents: -1_020 },
        { date: "2026-04-03", amountCents: -1_020 },
      ]),
    ).toBeNull();
  });

  it("waits for enough history rather than comparing two charges", () => {
    expect(
      amountDrift([
        { date: "2026-01-03", amountCents: -1_000 },
        { date: "2026-02-03", amountCents: -2_000 },
      ]),
    ).toBeNull();
  });
});

describe("a year against the year before", () => {
  const months = (start: number, count: number, cents: number) =>
    Array.from({ length: count }, (_, i) => ({
      month: `2026-${String(start + i).padStart(2, "0")}`,
      cents,
    }));

  it("compares rolling years, so a quarterly bill cannot fake a rise", () => {
    const series = [...months(1, 12, -4_000), ...months(1, 12, -5_000)];
    const result = yearOnYear(series);
    expect(result).toMatchObject({ previousCents: 48_000, recentCents: 60_000 });
    expect(result?.changePct).toBeCloseTo(25, 5);
  });

  it("has nothing to compare before two years are on file", () => {
    expect(yearOnYear(months(1, 12, -4_000))).toBeNull();
  });

  it("does not call a charge that started this year a rise", () => {
    expect(yearOnYear([...months(1, 12, 0), ...months(1, 12, -5_000)])).toBeNull();
  });
});

describe("comparing charges of different cadences", () => {
  it("puts a yearly premium and a weekly habit on the same monthly footing", () => {
    expect(monthlyCostCents({ cadence: "yearly", medianAmountCents: 24_000 })).toBe(2_000);
    expect(monthlyCostCents({ cadence: "quarterly", medianAmountCents: 4_500 })).toBe(1_500);
    expect(monthlyCostCents({ cadence: "monthly", medianAmountCents: 1_500 })).toBe(1_500);
    // 52/12, not 4: four weeks a month loses a payment a year.
    expect(monthlyCostCents({ cadence: "weekly", medianAmountCents: 1_000 })).toBe(4_333);
  });
});

describe("the pattern a suggested charge would match on", () => {
  it("uses the whole key when every label carries it", () => {
    expect(suggestPattern("veolia eau", ["PRLV SEPA VEOLIA EAU 12", "PRLV SEPA VEOLIA EAU 87"])).toBe(
      "VEOLIA EAU",
    );
  });

  it("falls back to the first word when the key's tokens are not adjacent", () => {
    // A pattern matching nothing would create a charge reported unpaid forever.
    expect(suggestPattern("orange france", ["PRLV ORANGE SEPA FRANCE 12"])).toBe("ORANGE");
  });
});

describe("how much a charge is allowed to wander", () => {
  it("keeps a subscription tight", () => {
    const netflix = monthly("2026-01", 5, -1_599);
    expect(suggestedTolerancePct(netflix, 1_599)).toBe(5);
  });

  it("gives an energy bill room, or the badge would never be off", () => {
    const edf = [-8_900, -13_400, -7_600, -15_200, -9_100].map((amountCents, i) => ({
      date: `2026-0${i + 1}-05`,
      amountCents,
    }));
    expect(suggestedTolerancePct(edf, 9_100)).toBe(50);
  });

  it("does not let one catch-up bill set the tolerance", () => {
    // Four months at 30 euros and one at 120: the outlier is skipped, so the
    // charge is not given a 300% tolerance that would hide a real change.
    const occ = [-3_000, -3_000, -12_000, -3_100, -3_000].map((amountCents, i) => ({
      date: `2026-0${i + 1}-05`,
      amountCents,
    }));
    expect(suggestedTolerancePct(occ, 3_000)).toBe(5);
  });
});

describe("what a repeating charge costs now", () => {
  it("answers with the current price, not the one it had two years ago", () => {
    // Nine months at 13,49 and six at 15,99. A median over all of them says
    // 13,49, and a charge created at that figure reports every payment since
    // April as unusual.
    const netflix = [
      ...monthly("2025-06", 9, -1_349, 3),
      ...monthly("2026-03", 6, -1_599, 3),
    ];
    expect(detectRecurrence(netflix)?.medianAmountCents).toBe(1_599);
  });

  it("still ignores a single outlier", () => {
    const withCatchUp = monthly("2026-01", 6, -3_000).map((o, i) =>
      i === 3 ? { ...o, amountCents: -12_000 } : o,
    );
    expect(detectRecurrence(withCatchUp)?.medianAmountCents).toBe(3_000);
  });
});

describe("whether an amount can be called expected", () => {
  it("accepts a bill that moves with the seasons", () => {
    // Real EDF over a year: about a quarter either side of the middle.
    const edf = [-9_600, -14_200, -11_400, -10_800, -13_100, -9_900].map((amountCents, i) => ({
      date: `2026-0${i + 1}-12`,
      amountCents,
    }));
    expect(hasPredictableAmount(edf, 11_400)).toBe(true);
  });

  it("refuses the weekly shop", () => {
    // Seventeen euros one week and eighty-five the next is a habit, not a
    // charge, and no expected amount describes it.
    const courses = [-1_677, -8_477, -3_120, -5_454, -2_054, -8_431].map((amountCents, i) => ({
      date: `2026-0${i + 1}-07`,
      amountCents,
    }));
    expect(hasPredictableAmount(courses, 5_454)).toBe(false);
  });

  it("judges on the recent charges, so a price rise is not read as chaos", () => {
    const stepped = [
      ...monthly("2025-06", 9, -1_349, 3),
      ...monthly("2026-03", 6, -1_599, 3),
    ];
    expect(hasPredictableAmount(stepped, 1_599)).toBe(true);
  });
});

describe("comparing a year with an incomplete one", () => {
  const full = (cents: number) =>
    Array.from({ length: 12 }, (_, i) => ({ month: `m${i}`, cents }));

  it("refuses to compare twelve months of rent against three", () => {
    // Someone who started importing fifteen months ago. Dividing one window by
    // the other says the rent rose 300 %; what actually happened is that the
    // statements begin in month ten.
    const partial = [...Array.from({ length: 9 }, (_, i) => ({ month: `p${i}`, cents: 0 })),
      ...Array.from({ length: 3 }, (_, i) => ({ month: `q${i}`, cents: -90_000 }))];
    expect(yearOnYear([...partial, ...full(-90_000)])).toBeNull();
  });

  it("still reports a charge that ended, which really is a fall", () => {
    const stopped = [
      ...Array.from({ length: 6 }, (_, i) => ({ month: `r${i}`, cents: -3_000 })),
      ...Array.from({ length: 6 }, (_, i) => ({ month: `s${i}`, cents: 0 })),
    ];
    const result = yearOnYear([...full(-3_000), ...stopped]);
    expect(result?.changePct).toBeCloseTo(-50, 5);
  });

  it("compares a quarterly bill that landed four times on each side", () => {
    const quarterly = (cents: number) =>
      Array.from({ length: 12 }, (_, i) => ({ month: `m${i}`, cents: i % 3 === 0 ? cents : 0 }));
    const result = yearOnYear([...quarterly(-4_200), ...quarterly(-5_100)]);
    expect(result).toMatchObject({ previousCents: 16_800, recentCents: 20_400 });
  });
});
