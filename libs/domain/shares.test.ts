import { describe, it, expect } from "vitest";
import {
  TOTAL_BPS,
  applyShare,
  evenShares,
  formatBps,
  validateShares,
} from "./shares";

describe("validateShares", () => {
  it("accepts a sole owner at 100%", () => {
    expect(validateShares([{ personId: 1, shareBps: TOTAL_BPS }])).toBeNull();
  });

  it("accepts an even split and an uneven one that still totals 100%", () => {
    expect(
      validateShares([
        { personId: 1, shareBps: 5000 },
        { personId: 2, shareBps: 5000 },
      ]),
    ).toBeNull();
    expect(
      validateShares([
        { personId: 1, shareBps: 6000 },
        { personId: 2, shareBps: 4000 },
      ]),
    ).toBeNull();
  });

  it("rejects a total that is not exactly 100%", () => {
    expect(validateShares([{ personId: 1, shareBps: 9999 }])).toEqual({
      code: "bad_total",
      totalBps: 9999,
    });
    expect(
      validateShares([
        { personId: 1, shareBps: 6000 },
        { personId: 2, shareBps: 5000 },
      ]),
    ).toEqual({ code: "bad_total", totalBps: 11000 });
  });

  it("rejects the same person twice", () => {
    expect(
      validateShares([
        { personId: 1, shareBps: 5000 },
        { personId: 1, shareBps: 5000 },
      ]),
    ).toEqual({ code: "duplicate_person", personId: 1 });
  });

  it("rejects zero, negative and fractional shares", () => {
    expect(validateShares([{ personId: 1, shareBps: 0 }])?.code).toBe("out_of_range");
    expect(
      validateShares([
        { personId: 1, shareBps: -5000 },
        { personId: 2, shareBps: 15000 },
      ])?.code,
    ).toBe("out_of_range");
    expect(validateShares([{ personId: 1, shareBps: 100.5 }])?.code).toBe("out_of_range");
  });

  it("rejects an empty owner list", () => {
    expect(validateShares([])).toEqual({ code: "empty" });
  });
});

describe("applyShare", () => {
  it("takes a proportional slice", () => {
    expect(applyShare(270_000_00, 5000)).toBe(135_000_00);
    expect(applyShare(270_000_00, 6000)).toBe(162_000_00);
    expect(applyShare(270_000_00, TOTAL_BPS)).toBe(270_000_00);
  });

  it("keeps the sign of a liability", () => {
    expect(applyShare(-310_000_00, 5000)).toBe(-155_000_00);
  });

  it("rounds to the nearest cent", () => {
    // 3333 bps of 1,00 € = 33,33 cents
    expect(applyShare(100, 3333)).toBe(33);
    expect(applyShare(101, 5000)).toBe(51); // 50.5 rounds up
  });
});

describe("evenShares", () => {
  it("splits evenly between two", () => {
    expect(evenShares([7, 9])).toEqual([
      { personId: 7, shareBps: 5000 },
      { personId: 9, shareBps: 5000 },
    ]);
  });

  it("gives the indivisible remainder to the first person so the total is exact", () => {
    const three = evenShares([1, 2, 3]);
    expect(three.reduce((a, s) => a + s.shareBps, 0)).toBe(TOTAL_BPS);
    expect(three).toEqual([
      { personId: 1, shareBps: 3334 },
      { personId: 2, shareBps: 3333 },
      { personId: 3, shareBps: 3333 },
    ]);
    expect(validateShares(three)).toBeNull();
  });

  it("returns nothing for nobody", () => {
    expect(evenShares([])).toEqual([]);
  });
});

describe("formatBps", () => {
  it("renders whole and fractional percentages the French way", () => {
    expect(formatBps(5000)).toBe("50 %");
    expect(formatBps(TOTAL_BPS)).toBe("100 %");
    expect(formatBps(6250)).toBe("62,5 %");
  });
});
