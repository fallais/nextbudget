import { describe, it, expect } from "vitest";
import { Account, type NewAccount } from "@domain/entities";
import { DomainError } from "@domain/errors";

const courant: NewAccount = {
  ownerId: 1,
  visibility: "shared",
  kind: "personal",
  name: "Compte courant",
  bank: "Boursorama",
  iban: null,
  currency: "EUR",
  openingBalanceCents: null,
  openingBalanceDate: null,
};

describe("Account", () => {
  it("starts without an opening balance — only movements are known", () => {
    expect(Account.create(courant).hasOpeningBalance).toBe(false);
  });

  it("takes a balance with no date: everything imported sits after it", () => {
    // The whole-history case. The balance is 0 before the first line, so the
    // net of the import is the balance, and it matches the bank.
    const a = Account.create({ ...courant, openingBalanceCents: 0 });
    expect(a.hasOpeningBalance).toBe(true);
  });

  it("takes a signed balance — an account can be in the red", () => {
    expect(
      Account.create({ ...courant, openingBalanceCents: -45_00 }).hasOpeningBalance,
    ).toBe(true);
  });

  it("refuses a date with no balance to attach it to", () => {
    expect(() => Account.create({ ...courant, openingBalanceDate: "2026-02-01" })).toThrow(
      DomainError,
    );
  });

  it("still refuses an empty name", () => {
    expect(() => Account.create({ ...courant, name: "  " })).toThrow(DomainError);
  });
});
