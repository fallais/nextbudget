import { EntitySchema } from "typeorm";
import type { MerchantOverrideRow } from "@domain/entities";
import { createdAt, id, owner } from "./columns";

export const MerchantOverrideEntity = new EntitySchema<MerchantOverrideRow>({
  name: "merchant_overrides",
  columns: {
    id,
    ...owner,
    merchantKey: { name: "merchant_key", type: "text" },
    disabled: { type: Boolean, default: false },
    createdAt,
  },
  indices: [
    // One decision per merchant per owner: a second row would be a second
    // opinion the engine could not choose between.
    {
      name: "merchant_overrides_key_owner_uniq",
      columns: ["merchantKey", "ownerId"],
      unique: true,
    },
  ],
});
