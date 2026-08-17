import { describe, it, expect } from "vitest";
import { Asset, type NewAsset } from "@domain/entities";
import { Share } from "@domain/value-objects/share";
import { DomainError } from "@domain/errors";

const house: NewAsset = {
  ownerId: 1,
  visibility: "shared",
  name: "Maison",
  kind: "asset",
  type: "real_estate",
  valueCents: 270_000_00,
  currency: "EUR",
  principalCents: null,
  interestRateBps: null,
  termMonths: null,
  monthlyPaymentCents: null,
  insuranceMonthlyCents: null,
  feesCents: null,
  startDate: null,
  endDate: null,
  accountId: null,
  linkedAssetId: null,
  isActive: true,
  notes: null,
};

describe("Asset.create", () => {
  it("builds a valid asset", () => {
    expect(Asset.create(house).name).toBe("Maison");
  });

  it("refuses a type that does not belong to the nature", () => {
    // A debt is never "Immobilier" — that is the property, not the loan.
    expect(() => Asset.create({ ...house, kind: "liability" })).toThrow(DomainError);
    expect(() => Asset.create({ ...house, kind: "liability", type: "mortgage" })).not.toThrow();
  });

  it("refuses a nameless asset", () => {
    expect(() => Asset.create({ ...house, name: "   " })).toThrow(/nom/i);
  });

  it("refuses a negative value — a debt is negative by nature, not by sign", () => {
    expect(() => Asset.create({ ...house, valueCents: -1 })).toThrow(DomainError);
  });

  it("refuses nonsense loan terms", () => {
    expect(() => Asset.create({ ...house, termMonths: 0 })).toThrow(/durée/i);
    expect(() => Asset.create({ ...house, interestRateBps: -1 })).toThrow(/taux/i);
  });
});

describe("Asset behaviour", () => {
  const asset = Asset.create(house);
  const loan = Asset.create({
    ...house,
    name: "Crédit maison",
    kind: "liability",
    type: "mortgage",
    valueCents: 310_000_00,
    principalCents: 310_000_00,
    interestRateBps: 190,
    termMonths: 240,
  });

  it("signs its contribution to net worth by nature", () => {
    expect(asset.netWorthContribution.cents).toBe(270_000_00);
    expect(loan.netWorthContribution.cents).toBe(-310_000_00);
  });

  it("slices a share with the sign intact", () => {
    expect(asset.shareOf(Share.fromBps(5000)).cents).toBe(135_000_00);
    expect(loan.shareOf(Share.fromBps(5000)).cents).toBe(-155_000_00);
    // The pair reconciles to the household total instead of double-counting.
    expect(
      asset.shareOf(Share.fromBps(5000)).cents + loan.shareOf(Share.fromBps(5000)).cents,
    ).toBe(-20_000_00);
  });

  it("knows which liabilities can produce a schedule", () => {
    expect(asset.isLoan).toBe(false);
    expect(loan.isLoan).toBe(true);
    expect(loan.hasLoanTerms).toBe(true);
    expect(Asset.create({ ...house, kind: "liability", type: "loan" }).hasLoanTerms).toBe(false);
  });
});

describe("Asset identity", () => {
  it("compares by id, not by contents", () => {
    const a = Asset.reconstitute({ ...house, id: 7, createdAt: new Date() });
    const renamed = Asset.reconstitute({ ...house, id: 7, name: "Maison secondaire", createdAt: new Date() });
    const other = Asset.reconstitute({ ...house, id: 8, createdAt: new Date() });
    expect(a.equals(renamed)).toBe(true);
    expect(a.equals(other)).toBe(false);
  });

  it("treats unsaved assets as equal to nothing", () => {
    expect(Asset.create(house).equals(Asset.create(house))).toBe(false);
  });
});
