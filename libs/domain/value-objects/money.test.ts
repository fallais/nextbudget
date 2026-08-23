import { describe, it, expect } from "vitest";
import { Money } from "./money";
import { DomainError } from "@domain/errors";

/**
 * Money is signed integer cents everywhere in this app, and this class is what
 * keeps it that way. Every rule here exists because the alternative is a
 * rounding error that only shows up as a balance being one cent out months
 * later.
 */

describe("Money.fromCents", () => {
  it("refuses a fraction of a cent", () => {
    // The classic route in is a division or a percentage applied without
    // rounding; catching it here is what stops 0.1 + 0.2 reaching a ledger.
    expect(() => Money.fromCents(12.5)).toThrow(DomainError);
    expect(() => Money.fromCents(0.1 + 0.2)).toThrow(DomainError);
  });

  it("refuses NaN and infinity, which are integers to nobody", () => {
    expect(() => Money.fromCents(Number.NaN)).toThrow(DomainError);
    expect(() => Money.fromCents(Number.POSITIVE_INFINITY)).toThrow(DomainError);
  });

  it("refuses an amount past the safe integer range", () => {
    // Beyond this, arithmetic silently stops being exact.
    expect(() => Money.fromCents(Number.MAX_SAFE_INTEGER + 2)).toThrow(DomainError);
  });

  it("keeps the sign, a debit being negative rather than a magnitude", () => {
    expect(Money.fromCents(-1250).cents).toBe(-1250);
    expect(Money.fromCents(-1250).isNegative).toBe(true);
    expect(Money.fromCents(0).isZero).toBe(true);
    expect(Money.fromCents(1).isNegative).toBe(false);
  });
});

describe("Money.positiveFromCents", () => {
  it("refuses a negative amount", () => {
    // A debt is negative by virtue of being a liability, never by carrying a
    // minus sign, or net worth double-counts it.
    expect(() => Money.positiveFromCents(-1)).toThrow(DomainError);
  });

  it("allows zero", () => {
    expect(Money.positiveFromCents(0).cents).toBe(0);
  });

  it("still refuses a fraction", () => {
    expect(() => Money.positiveFromCents(1.5)).toThrow(DomainError);
  });
});

describe("arithmetic", () => {
  const a = Money.fromCents(1000);
  const b = Money.fromCents(250);

  it("adds and subtracts exactly", () => {
    expect(a.plus(b).cents).toBe(1250);
    expect(a.minus(b).cents).toBe(750);
    expect(b.minus(a).cents).toBe(-750);
  });

  it("rounds a multiplication to the nearest cent", () => {
    // 3.5 rounds up, and the caller decides whether that drift matters.
    expect(Money.fromCents(1).times(3.5).cents).toBe(4);
    expect(Money.fromCents(1000).times(0.155).cents).toBe(155);
  });

  it("never produces a fractional result from a multiplication", () => {
    for (const factor of [1 / 3, 0.07, 1.10005]) {
      expect(Number.isInteger(Money.fromCents(999).times(factor).cents)).toBe(true);
    }
  });

  it("takes an absolute value and a negation without losing exactness", () => {
    expect(Money.fromCents(-1250).abs().cents).toBe(1250);
    expect(Money.fromCents(1250).negated().cents).toBe(-1250);
    expect(Money.fromCents(0).negated().cents).toBe(-0);
  });

  it("compares by value, not identity", () => {
    expect(Money.fromCents(500).equals(Money.fromCents(500))).toBe(true);
    expect(Money.fromCents(500).equals(Money.fromCents(501))).toBe(false);
  });

  it("has a shared zero", () => {
    expect(Money.zero.cents).toBe(0);
    expect(Money.zero.isZero).toBe(true);
  });

  it("refuses to overflow past exact arithmetic", () => {
    const huge = Money.fromCents(Number.MAX_SAFE_INTEGER);
    expect(() => huge.plus(Money.fromCents(10))).toThrow(DomainError);
  });
});
