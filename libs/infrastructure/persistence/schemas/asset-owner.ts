import { EntitySchema } from "typeorm";
import type { AssetOwnerRow } from "@domain/entities";
import { bigintNumber, id } from "./columns";

export const AssetOwnerEntity = new EntitySchema<AssetOwnerRow>({
  name: "asset_owners",
  columns: {
    id,
    assetId: { name: "asset_id", type: Number },
    personId: { name: "person_id", type: Number },
    shareBps: { name: "share_bps", type: Number },
    // Nullable on purpose: rows written before per-borrower insurance existed,
    // and every asset that is not a loan, simply have nothing to say here.
    insuranceMonthlyCents: {
      name: "insurance_monthly_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
  },
  indices: [
    { name: "asset_owners_asset_idx", columns: ["assetId"] },
    {
      name: "asset_owners_asset_person_uniq",
      columns: ["assetId", "personId"],
      unique: true,
    },
  ],
});
