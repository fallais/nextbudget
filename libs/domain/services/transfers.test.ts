import { describe, it, expect } from "vitest";
import { pairTransfers, refuseTransfer, type TransferLeg } from "./transfers";

function leg(id: number, accountId: number, date: string, amountCents: number): TransferLeg {
  return { id, accountId, date, amountCents };
}

describe("pairing the legs of a transfer", () => {
  it("marries a debit to the credit of the same amount in another account", () => {
    const pairs = pairTransfers([
      leg(1, 1, "2026-03-05", -50_000),
      leg(2, 2, "2026-03-05", 50_000),
    ]);
    expect(pairs).toEqual([{ debitId: 1, creditId: 2 }]);
  });

  it("crosses a weekend but not a fortnight", () => {
    expect(
      pairTransfers([leg(1, 1, "2026-03-06", -50_000), leg(2, 2, "2026-03-10", 50_000)]),
    ).toHaveLength(1);
    expect(
      pairTransfers([leg(1, 1, "2026-03-06", -50_000), leg(2, 2, "2026-03-20", 50_000)]),
    ).toEqual([]);
  });

  it("leaves a purchase and an unrelated refund alone when they share an account", () => {
    // Money out and back inside one account is a reversal, and reversals net
    // out on their own. Calling it a transfer would hide a real refund.
    expect(
      pairTransfers([leg(1, 1, "2026-03-05", -50_000), leg(2, 1, "2026-03-06", 50_000)]),
    ).toEqual([]);
  });

  it("never spends a leg twice", () => {
    // One debit, two candidate credits: the second credit is somebody else's
    // money arriving and must stay in the income figures.
    const pairs = pairTransfers([
      leg(1, 1, "2026-03-05", -50_000),
      leg(2, 2, "2026-03-05", 50_000),
      leg(3, 3, "2026-03-05", 50_000),
    ]);
    expect(pairs).toEqual([{ debitId: 1, creditId: 2 }]);
  });

  it("gives each debit its nearest credit rather than the first one seen", () => {
    // Two standing transfers of the same amount a week apart. Pairing by
    // arrival order would cross them over: harmless for the totals, but it
    // would report a transfer that took eight days to land.
    const pairs = pairTransfers([
      leg(10, 2, "2026-03-12", 30_000),
      leg(11, 2, "2026-03-05", 30_000),
      leg(12, 1, "2026-03-05", -30_000),
      leg(13, 1, "2026-03-12", -30_000),
    ]);
    expect(pairs).toEqual([
      { debitId: 12, creditId: 11 },
      { debitId: 13, creditId: 10 },
    ]);
  });

  it("does not pair on the amount alone", () => {
    expect(
      pairTransfers([leg(1, 1, "2026-03-05", -50_000), leg(2, 2, "2026-03-05", 49_900)]),
    ).toEqual([]);
  });

  it("returns the same pairs whatever order the rows arrive in", () => {
    const rows = [
      leg(1, 1, "2026-03-05", -50_000),
      leg(2, 2, "2026-03-06", 50_000),
      leg(3, 1, "2026-03-20", -20_000),
      leg(4, 3, "2026-03-21", 20_000),
    ];
    expect(pairTransfers([...rows].reverse())).toEqual(pairTransfers(rows));
  });
});

describe("declaring a transfer by hand", () => {
  it("accepts a single leg, because the other account may not be tracked here", () => {
    expect(refuseTransfer([{ accountId: 1 }], false)).toBeNull();
  });

  it("refuses a line that already belongs to a transfer", () => {
    expect(refuseTransfer([{ accountId: 1 }, { accountId: 2 }], true)).toBe("already_linked");
  });

  it("refuses two lines from the same account", () => {
    expect(refuseTransfer([{ accountId: 1 }, { accountId: 1 }], false)).toBe("same_account");
  });

  it("refuses an empty selection", () => {
    expect(refuseTransfer([], false)).toBe("no_legs");
  });
});
