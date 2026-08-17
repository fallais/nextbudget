import { describe, it, expect } from "vitest";
import { Ownership, Share, TOTAL_BPS, formatBps } from "@domain/value-objects/share";
import { DomainError } from "@domain/errors";

describe("Share", () => {
  it("rejects anything outside 0,01 %–100 %", () => {
    expect(() => Share.fromBps(0)).toThrow(DomainError);
    expect(() => Share.fromBps(-5000)).toThrow(DomainError);
    expect(() => Share.fromBps(TOTAL_BPS + 1)).toThrow(DomainError);
    expect(() => Share.fromBps(100.5)).toThrow(DomainError);
    expect(Share.fromBps(5000).bps).toBe(5000);
  });

  it("builds from a percentage as typed by a user", () => {
    expect(Share.fromPercent(62.5).bps).toBe(6250);
    expect(Share.fromPercent(100).isWhole).toBe(true);
  });

  it("takes a proportional slice, rounded to the cent", () => {
    expect(Share.fromBps(5000).applyTo(270_000_00)).toBe(135_000_00);
    expect(Share.fromBps(6000).applyTo(270_000_00)).toBe(162_000_00);
    // Sign is preserved so a liability slice stays a liability.
    expect(Share.fromBps(5000).applyTo(-310_000_00)).toBe(-155_000_00);
    expect(Share.fromBps(3333).applyTo(100)).toBe(33);
    expect(Share.fromBps(5000).applyTo(101)).toBe(51); // 50.5 rounds up
  });

  it("renders the French way", () => {
    expect(Share.fromBps(5000).format()).toBe("50 %");
    expect(Share.fromBps(TOTAL_BPS).format()).toBe("100 %");
    expect(Share.fromBps(6250).format()).toBe("62,5 %");
    // Invalid totals still need rendering in error messages.
    expect(formatBps(11000)).toBe("110 %");
  });
});

describe("Ownership", () => {
  it("accepts a sole owner and any split totalling 100 %", () => {
    expect(Ownership.sole(1).toRows()).toEqual([{ personId: 1, shareBps: TOTAL_BPS }]);
    expect(
      Ownership.fromRows([
        { personId: 1, shareBps: 6000 },
        { personId: 2, shareBps: 4000 },
      ]).toRows(),
    ).toHaveLength(2);
  });

  it("refuses a total that is not exactly 100 %", () => {
    expect(() => Ownership.fromRows([{ personId: 1, shareBps: 9999 }])).toThrow(
      /100 %/,
    );
    expect(() =>
      Ownership.fromRows([
        { personId: 1, shareBps: 6000 },
        { personId: 2, shareBps: 5000 },
      ]),
    ).toThrow(/110 %/);
  });

  it("refuses the same person twice, and an empty set", () => {
    expect(() =>
      Ownership.fromRows([
        { personId: 1, shareBps: 5000 },
        { personId: 1, shareBps: 5000 },
      ]),
    ).toThrow(DomainError);
    expect(() => Ownership.fromRows([])).toThrow(DomainError);
  });

  it("splits evenly, giving the indivisible remainder to the first person", () => {
    expect(Ownership.even([7, 9]).toRows()).toEqual([
      { personId: 7, shareBps: 5000 },
      { personId: 9, shareBps: 5000 },
    ]);
    const three = Ownership.even([1, 2, 3]);
    expect(three.toRows().reduce((a, s) => a + s.shareBps, 0)).toBe(TOTAL_BPS);
    expect(three.toRows()).toEqual([
      { personId: 1, shareBps: 3334 },
      { personId: 2, shareBps: 3333 },
      { personId: 3, shareBps: 3333 },
    ]);
  });

  it("finds a person's share, or reports they have none", () => {
    const owned = Ownership.even([1, 2]);
    expect(owned.shareFor(1)?.bps).toBe(5000);
    expect(owned.shareFor(99)).toBeNull();
  });
});
