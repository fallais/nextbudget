import { describe, it, expect } from "vitest";
import { coverFromPool, type CoverableMonth } from "./consolidation";

type M = CoverableMonth;
const month = (month: string, state: string): M => ({ month, state, receivedCents: 0 });
const apport = (expectedAmountCents: number, states: [string, string][]) => ({
  expectedAmountCents,
  months: states.map(([m, s]) => month(m, s)),
});
const statesOf = (a: { months: M[] }) => a.months.map((m) => m.state);

describe("coverFromPool", () => {
  it("leaves everything alone when nothing is missing", () => {
    const a = apport(400_00, [["2026-01", "received"]]);
    coverFromPool([a], new Map([["2026-01", 900_00]]));
    expect(statesOf(a)).toEqual(["received"]);
  });

  it("covers a missed month from a lump that arrived that month", () => {
    const a = apport(400_00, [["2026-01", "missed"]]);
    const left = coverFromPool([a], new Map([["2026-01", 400_00]]));
    expect(statesOf(a)).toEqual(["covered"]);
    expect(left.get("2026-01")).toBe(0);
  });

  it("never covers more than the pool holds", () => {
    // 910 € against 1 154 € of shortfall: the big two fit, the last does not.
    const big = apport(623_00, [["2026-01", "missed"]]);
    const mid = apport(400_00, [["2026-01", "missed"]]);
    const small = apport(131_50, [["2026-01", "missed"]]);
    const left = coverFromPool([big, mid, small], new Map([["2026-01", 910_00]]));
    expect(statesOf(big)).toEqual(["covered"]);
    expect(statesOf(mid)).toEqual(["missed"]);
    expect(statesOf(small)).toEqual(["covered"]);
    expect(left.get("2026-01")).toBe(910_00 - 623_00 - 131_50);
  });

  it("spends on the largest shortfall it can settle, not the first it meets", () => {
    const small = apport(50_00, [["2026-01", "missed"]]);
    const big = apport(300_00, [["2026-01", "missed"]]);
    coverFromPool([small, big], new Map([["2026-01", 300_00]]));
    expect(statesOf(big)).toEqual(["covered"]);
    expect(statesOf(small)).toEqual(["missed"]);
  });

  it("keeps each month's money to itself", () => {
    // January's surplus cannot settle February: a catch-up pays what it paid,
    // and carrying it forward would invent a payment that never happened.
    const a = apport(100_00, [["2026-01", "missed"], ["2026-02", "missed"]]);
    coverFromPool([a], new Map([["2026-01", 500_00]]));
    expect(statesOf(a)).toEqual(["covered", "missed"]);
  });

  it("does nothing with an empty pool", () => {
    const a = apport(100_00, [["2026-01", "missed"]]);
    coverFromPool([a], new Map());
    expect(statesOf(a)).toEqual(["missed"]);
  });

  it("leaves pending and before alone — they are not shortfalls", () => {
    const a = apport(100_00, [["2026-01", "before"], ["2026-02", "pending"]]);
    coverFromPool([a], new Map([["2026-01", 900_00], ["2026-02", 900_00]]));
    expect(statesOf(a)).toEqual(["before", "pending"]);
  });

  it("reports what is left, which is the evidence for the change", () => {
    const a = apport(100_00, [["2026-01", "missed"]]);
    const left = coverFromPool([a], new Map([["2026-01", 531_00]]));
    expect(left.get("2026-01")).toBe(431_00);
  });
});
