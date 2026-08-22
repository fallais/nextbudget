import { EntitySchema } from "typeorm";
import type { PrepaymentRow } from "@domain/entities";
import { bigintNumber, createdAt, id } from "./columns";

export const PrepaymentEntity = new EntitySchema<PrepaymentRow>({
  name: "loan_prepayments",
  columns: {
    id,
    assetId: { name: "asset_id", type: Number },
    date: { type: "text" },
    amountCents: { name: "amount_cents", type: "bigint", transformer: bigintNumber },
    mode: { type: "text", default: "duration" },
    feesCents: {
      name: "fees_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    notes: { type: "text", nullable: true },
    createdAt,
  },
  indices: [{ name: "loan_prepayments_asset_idx", columns: ["assetId"] }],
});
