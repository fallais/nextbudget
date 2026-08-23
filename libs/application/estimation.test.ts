import { describe, it, expect } from "vitest";
import { estimateAsset, toNewEstimation, type EstimationDeps } from "./estimation";
import { Asset, Estimation, type AssetRow } from "@domain/entities";
import type { Estimate, Subject } from "@domain/services/estimation";

/**
 * Every number distinct, so a field copied from the wrong place cannot pass.
 * Two fields holding the same value would hide exactly the mistake this is
 * here to catch.
 */
const result: Estimate = {
  valueCents: 1,
  pricePerM2Cents: 2,
  lowCents: 3,
  highCents: 4,
  sampleSize: 5,
  radiusM: 6,
  oldestDate: "2023-05-31",
  newestDate: "2025-12-23",
  marketCents: 7,
  landAdjustmentCents: 8,
  comparableLandM2: 9,
  creditedLandM2: 10,
  conditionAdjustmentCents: 11,
};

const subject: Subject = {
  surfaceM2: 12,
  landM2: 13,
  latitude: 43.6,
  longitude: 1.4,
  condition: "a_renover",
};

describe("toNewEstimation", () => {
  it("copies every field from where it belongs", () => {
    expect(toNewEstimation(99, result, "Une adresse", subject)).toEqual({
      assetId: 99,
      valueCents: 1,
      pricePerM2Cents: 2,
      lowCents: 3,
      highCents: 4,
      marketCents: 7,
      landAdjustmentCents: 8,
      conditionAdjustmentCents: 11,
      comparableLandM2: 9,
      creditedLandM2: 10,
      sampleSize: 5,
      radiusM: 6,
      oldestDate: "2023-05-31",
      newestDate: "2025-12-23",
      address: "Une adresse",
      surfaceM2: 12,
      landM2: 13,
      condition: "a_renover",
    });
  });

  it("stores the address the geocoder returned, not the one that was typed", () => {
    // What was compared against is what the geocoder resolved; storing the
    // raw input would make an old estimate impossible to place.
    expect(toNewEstimation(1, result, "Route de X 31000 Y", subject).address).toBe(
      "Route de X 31000 Y",
    );
  });

  it("keeps the plot and the condition as they were at the time", () => {
    const row = toNewEstimation(1, result, "a", { ...subject, landM2: null, condition: null });
    expect(row.landM2).toBeNull();
    expect(row.condition).toBeNull();
    // Still records what the plot adjustment actually credited, which is a
    // fact about the comparables rather than about the property.
    expect(row.creditedLandM2).toBe(10);
  });

  it("carries a breakdown that adds up to the figure it stores", () => {
    const row = toNewEstimation(1, result, "a", subject);
    expect(row.marketCents + row.landAdjustmentCents + row.conditionAdjustmentCents).toBe(
      7 + 8 + 11,
    );
  });
});

const NOW = new Date("2026-08-23T00:00:00Z");

const property: AssetRow = {
  id: 1, ownerId: null, visibility: "shared", name: "Maison", kind: "asset",
  type: "real_estate", valueCents: 100_000_00, currency: "EUR",
  principalCents: null, interestRateBps: null, taegBps: null, termMonths: null,
  monthlyPaymentCents: null, insuranceMonthlyCents: null, feesCents: null,
  signatureDate: null, startDate: null, endDate: null,
  address: "Une rue, une commune", surfaceM2: 100, landM2: null,
  propertyKind: "maison", propertyCondition: null,
  accountId: null, linkedAssetId: null, isActive: true, notes: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

/** Fails the test if the use case reaches for it. */
const neverCalled = () => {
  throw new Error("should not have been called");
};

function deps(over: Partial<EstimationDeps> = {}): EstimationDeps {
  return {
    assets: {
      findById: async () => Asset.reconstitute(property),
      addEstimation: async (input) => Estimation.create(input),
    },
    geocode: neverCalled,
    fetchComparables: neverCalled,
    ...over,
  };
}

/** A commune of identical sales, all next door, all the subject's size. */
const market = (n: number, pricePerM2: number) => ({
  comparables: Array.from({ length: n }, (_, i) => ({
    valueCents: pricePerM2 * 100 * 100,
    surfaceM2: 100,
    landM2: 0,
    date: "2025-06-01",
    latitude: 43.6 + i / 1_000_000,
    longitude: 1.4,
  })),
  landRateCents: null,
});

const located = {
  label: "Une rue, 31000 Une commune",
  latitude: 43.6,
  longitude: 1.4,
  cityCode: "31000",
  departmentCode: "31",
};

describe("estimateAsset", () => {
  it("says which inputs are missing, without asking anyone anything", async () => {
    // The whole point of the seam: no database, no geocoder, no open data.
    const out = await estimateAsset(
      1,
      NOW,
      deps({
        assets: {
          findById: async () => Asset.reconstitute({ ...property, surfaceM2: null, address: "  " }),
          addEstimation: neverCalled,
        },
      }),
    );
    expect(out).toEqual({ status: "incomplete", missing: ["address", "surfaceM2"] });
  });

  it("reports an unknown property rather than estimating one", async () => {
    const out = await estimateAsset(
      404,
      NOW,
      deps({ assets: { findById: async () => null, addEstimation: neverCalled } }),
    );
    expect(out).toEqual({ status: "not_found" });
  });

  it("stops at an address the geocoder cannot place", async () => {
    const out = await estimateAsset(1, NOW, deps({ geocode: async () => null }));
    expect(out).toEqual({ status: "not_geocoded" });
  });

  it("records the estimate it arrived at", async () => {
    const written: unknown[] = [];
    const out = await estimateAsset(
      1,
      NOW,
      deps({
        geocode: async () => located,
        fetchComparables: async () => market(10, 3000),
        assets: {
          findById: async () => Asset.reconstitute(property),
          addEstimation: async (input) => {
            written.push(input);
            return Estimation.create(input);
          },
        },
      }),
    );
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.estimate.valueCents).toBe(300_000_00);
    expect(out.address).toBe(located.label);
    // Written once, with the geocoder's address rather than the typed one.
    expect(written).toHaveLength(1);
    expect(out.saved.address).toBe(located.label);
  });

  it("widens the circle before giving up, and gives up rather than reaching across town", async () => {
    // Five sales 3 km out: too far for 500 m, found at 5 000 m.
    const far = market(5, 3000);
    far.comparables.forEach((c) => (c.latitude = 43.6 + 3000 / 111_320));
    const found = await estimateAsset(
      1,
      NOW,
      deps({ geocode: async () => located, fetchComparables: async () => far }),
    );
    expect(found.status).toBe("ok");
    if (found.status === "ok") expect(found.estimate.radiusM).toBe(5000);

    const tooFar = market(5, 3000);
    tooFar.comparables.forEach((c) => (c.latitude = 43.6 + 40_000 / 111_320));
    const out = await estimateAsset(
      1,
      NOW,
      deps({ geocode: async () => located, fetchComparables: async () => tooFar }),
    );
    expect(out).toEqual({ status: "too_few_sales" });
  });

  it("does not record anything when it has nothing to record", async () => {
    // addEstimation is neverCalled: reaching it at all fails the test.
    const out = await estimateAsset(
      1,
      NOW,
      deps({
        geocode: async () => located,
        fetchComparables: async () => market(2, 3000),
        assets: {
          findById: async () => Asset.reconstitute(property),
          addEstimation: neverCalled,
        },
      }),
    );
    expect(out).toEqual({ status: "too_few_sales" });
  });
});
