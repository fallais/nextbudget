import { EntitySchema } from "typeorm";
import type { EstimationRow } from "@domain/entities";
import { bigintNumber, createdAt, id } from "./columns";

export const EstimationEntity = new EntitySchema<EstimationRow>({
  name: "asset_estimations",
  columns: {
    id,
    assetId: { name: "asset_id", type: Number },
    valueCents: { name: "value_cents", type: "bigint", transformer: bigintNumber },
    pricePerM2Cents: { name: "price_per_m2_cents", type: "bigint", transformer: bigintNumber },
    lowCents: { name: "low_cents", type: "bigint", transformer: bigintNumber },
    highCents: { name: "high_cents", type: "bigint", transformer: bigintNumber },
    marketCents: { name: "market_cents", type: "bigint", transformer: bigintNumber },
    landAdjustmentCents: {
      name: "land_adjustment_cents",
      type: "bigint",
      transformer: bigintNumber,
    },
    conditionAdjustmentCents: {
      name: "condition_adjustment_cents",
      type: "bigint",
      transformer: bigintNumber,
    },
    comparableLandM2: { name: "comparable_land_m2", type: Number, nullable: true },
    creditedLandM2: { name: "credited_land_m2", type: Number, nullable: true },
    sampleSize: { name: "sample_size", type: Number },
    radiusM: { name: "radius_m", type: Number },
    oldestDate: { name: "oldest_date", type: "text" },
    newestDate: { name: "newest_date", type: "text" },
    address: { type: "text" },
    surfaceM2: { name: "surface_m2", type: Number },
    landM2: { name: "land_m2", type: Number, nullable: true },
    condition: { type: "text", nullable: true },
    createdAt,
  },
  indices: [{ name: "asset_estimations_asset_idx", columns: ["assetId"] }],
});
