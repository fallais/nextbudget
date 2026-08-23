import { describe, it, expect } from "vitest";
import {
  formatCents,
  formatCentsCompact,
  formatDateLong,
  formatDateShort,
  parseAmountToCents,
} from "./format";

/**
 * French formatting separates thousands with U+202F and U+00A0 depending on
 * the ICU build, so asserting the exact codepoint would fail on somebody
 * else's Node rather than on a real regression. The shape is what matters.
 */
const spaces = (s: string) => s.replace(/[\s  ]/g, " ");

describe("parseAmountToCents", () => {
  it("reads every convention a bank might export, as the same amount", () => {
    // French, French with dotted thousands, English, and plain.
    expect(parseAmountToCents("1 234,56")).toBe(123456);
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("1,234.56")).toBe(123456);
    expect(parseAmountToCents("1234.56")).toBe(123456);
  });

  it("reads the spaces a French export actually contains", () => {
    // Not the space on the keyboard: fr-FR emits U+202F, and files pasted out
    // of a bank's web page carry U+00A0.
    expect(parseAmountToCents("1 234,56")).toBe(123456);
    expect(parseAmountToCents("1 234,56")).toBe(123456);
  });

  it("takes a lone comma as the decimal separator, not thousands", () => {
    // Ambiguous by nature — "1,234" is one-and-a-bit here and one thousand in
    // an English file. This app is French, and reads it the French way.
    expect(parseAmountToCents("1,234")).toBe(123);
    expect(parseAmountToCents("12,5")).toBe(1250);
  });

  it("understands both ways of writing a debit", () => {
    expect(parseAmountToCents("-1234.56")).toBe(-123456);
    // Accounting parentheses, which several exports use instead of a minus.
    expect(parseAmountToCents("(1234.56)")).toBe(-123456);
    expect(parseAmountToCents("+1234.56")).toBe(123456);
  });

  it("lands on the cent rather than near it", () => {
    expect(parseAmountToCents("0,07")).toBe(7);
    expect(parseAmountToCents("0,1")).toBe(10);
    expect(parseAmountToCents("-0,01")).toBe(-1);
  });

  it("refuses what is not an amount", () => {
    expect(() => parseAmountToCents("abc")).toThrow();
    expect(() => parseAmountToCents("12,34,56")).toThrow();
  });

  it("returns zero for an empty field, which every caller must guard", () => {
    // Not a throw, so a parser that passes a blank column straight through
    // writes a transaction of nothing instead of failing. `csv-generic`
    // checks for the empty string before calling; a new parser must too.
    expect(parseAmountToCents("")).toBe(0);
    expect(parseAmountToCents("   ")).toBe(0);
  });
});

describe("formatCents", () => {
  it("writes money the French way", () => {
    expect(spaces(formatCents(123456))).toBe("1 234,56 €");
    expect(spaces(formatCents(0))).toBe("0,00 €");
  });

  it("keeps the two decimals a cent needs", () => {
    expect(spaces(formatCents(100))).toBe("1,00 €");
    expect(spaces(formatCents(7))).toBe("0,07 €");
  });

  it("signs a negative amount rather than relying on colour", () => {
    expect(spaces(formatCents(-123456))).toContain("-");
  });
});

describe("formatCentsCompact", () => {
  it("abbreviates only once the figure is long enough to need it", () => {
    expect(spaces(formatCentsCompact(999_999))).toBe("9 999,99 €");
    expect(spaces(formatCentsCompact(1_000_000))).toBe("10,00 k€");
    expect(spaces(formatCentsCompact(100_000_000))).toBe("1,00 M€");
  });
});

describe("dates", () => {
  it("writes them the French way round", () => {
    expect(formatDateShort("2026-05-15")).toBe("15/05/2026");
    expect(formatDateLong("2026-05-15")).toBe("15 mai 2026");
  });

  it("does not slide a date across a timezone", () => {
    // parseISO on a bare date is local midnight; formatting it must give the
    // same day back, not the one before.
    expect(formatDateShort("2026-01-01")).toBe("01/01/2026");
    expect(formatDateShort("2026-12-31")).toBe("31/12/2026");
  });
});
