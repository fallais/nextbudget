import { EntitySchema } from "typeorm";
import type { AssetValuationRow } from "@domain/entities";
import { bigintNumber, id } from "./columns";

export const AssetValuationEntity = new EntitySchema<AssetValuationRow>({
  name: "asset_valuations",
  columns: {
    id,
    assetId: { name: "asset_id", type: Number },
    date: { type: "text" },
    valueCents: { name: "value_cents", type: "bigint", transformer: bigintNumber },
  },
  indices: [{ name: "asset_valuations_asset_idx", columns: ["assetId"] }],
});
