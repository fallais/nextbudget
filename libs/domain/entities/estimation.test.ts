import { describe, it, expect } from "vitest";
import { Estimation, type NewEstimation } from "./estimation";
import { DomainError } from "@domain/errors";

const input: NewEstimation = {
  assetId: 1,
  valueCents: 379_000_00,
  pricePerM2Cents: 3_445_00,
  lowCents: 323_000_00,
  highCents: 412_000_00,
  marketCents: 265_000_00,
  landAdjustmentCents: 114_000_00,
  conditionAdjustmentCents: 0,
  comparableLandM2: 779,
  creditedLandM2: 2185,
  sampleSize: 10,
  radiusM: 500,
  oldestDate: "2023-05-31",
  newestDate: "2025-12-23",
  address: "Une adresse",
  surfaceM2: 110,
  landM2: 5000,
  condition: "bon",
};

describe("Estimation", () => {
  it("keeps the breakdown, not just the total", () => {
    const row = Estimation.create(input).toRow();
    expect(row.marketCents + row.landAdjustmentCents + row.conditionAdjustmentCents).toBe(
      row.valueCents,
    );
  });

  it("keeps the inputs it was computed on", () => {
    // A property gains a veranda; last year's figure has to be readable
    // against last year's surface, not today's.
    const row = Estimation.create({ ...input, surfaceM2: 90 }).toRow();
    expect(row.surfaceM2).toBe(90);
    expect(row.landM2).toBe(5000);
  });

  it("refuses an estimate drawn from no sales at all", () => {
    expect(() => Estimation.create({ ...input, sampleSize: 0 })).toThrow(DomainError);
  });

  it("refuses an estimate of nothing", () => {
    expect(() => Estimation.create({ ...input, surfaceM2: 0 })).toThrow(DomainError);
  });
});
