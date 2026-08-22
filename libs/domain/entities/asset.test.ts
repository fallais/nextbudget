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
  taegBps: null,
  termMonths: null,
  monthlyPaymentCents: null,
  insuranceMonthlyCents: null,
  feesCents: null,
  signatureDate: null,
  startDate: null,
  endDate: null,
  address: null,
  surfaceM2: null,
  propertyKind: null,
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
    name: "Prêt immobilier",
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

describe("Asset.outstandingCents", () => {
  /** Invented terms: 310 000 € at 1,90 % over 240 months, first instalment 2020-06. */
  const mortgage: NewAsset = {
    ...house,
    name: "Prêt immobilier",
    kind: "liability",
    type: "mortgage",
    // Deliberately wrong: the stored column is the stale hand-typed figure
    // that deriving is meant to replace.
    valueCents: 999_999_00,
    principalCents: 310_000_00,
    interestRateBps: 190,
    termMonths: 240,
    startDate: "2020-06-01",
  };

  const at = (row: NewAsset, today: string) =>
    Asset.reconstitute({ ...row, id: 1, createdAt: new Date() }).outstandingCents(today);

  it("derives the balance from the schedule, ignoring the stored value", () => {
    const owed = at(mortgage, "2026-08-18");
    expect(owed).not.toBe(999_999_00);
    // Six years into a twenty-year loan: most of the capital is still owed,
    // but a real dent has been made.
    expect(owed).toBeGreaterThan(200_000_00);
    expect(owed).toBeLessThan(250_000_00);
  });

  it("falls to zero once the term is over", () => {
    expect(at(mortgage, "2045-01-01")).toBe(0);
  });

  it("is the full capital before the first instalment", () => {
    expect(at(mortgage, "2020-01-01")).toBe(310_000_00);
  });

  it("decreases month after month", () => {
    expect(at(mortgage, "2026-08-18")).toBeLessThan(at(mortgage, "2025-08-18"));
  });

  it("keeps the stored value when there is no start date to anchor a schedule", () => {
    expect(at({ ...mortgage, startDate: null }, "2026-08-18")).toBe(999_999_00);
  });

  it("keeps the stored value for a debt with no loan terms", () => {
    const plainDebt: NewAsset = {
      ...house,
      name: "Dette familiale",
      kind: "liability",
      type: "other",
      valueCents: 5_000_00,
      principalCents: null,
      interestRateBps: null,
      termMonths: null,
      startDate: null,
    };
    expect(at(plainDebt, "2026-08-18")).toBe(5_000_00);
  });

  it("leaves plain assets alone", () => {
    expect(at(house, "2026-08-18")).toBe(270_000_00);
  });
});
