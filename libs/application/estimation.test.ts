import { describe, it, expect } from "vitest";
import { toNewEstimation } from "./estimation";
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
