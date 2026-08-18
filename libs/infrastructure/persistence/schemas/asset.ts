import { EntitySchema } from "typeorm";
import type { AssetRow } from "@domain/entities";
import { bigintNumber, createdAt, id, owner } from "./columns";

export const AssetEntity = new EntitySchema<AssetRow>({
  name: "assets",
  columns: {
    id,
    ...owner,
    name: { type: "text" },
    kind: { type: "text" },
    type: { type: "text", default: "other" },
    valueCents: {
      name: "value_cents",
      type: "bigint",
      default: 0,
      transformer: bigintNumber,
    },
    currency: { type: "text", default: "EUR" },
    principalCents: {
      name: "principal_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    interestRateBps: { name: "interest_rate_bps", type: Number, nullable: true },
    taegBps: { name: "taeg_bps", type: Number, nullable: true },
    termMonths: { name: "term_months", type: Number, nullable: true },
    monthlyPaymentCents: {
      name: "monthly_payment_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    insuranceMonthlyCents: {
      name: "insurance_monthly_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    feesCents: {
      name: "fees_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    signatureDate: { name: "signature_date", type: "text", nullable: true },
    startDate: { name: "start_date", type: "text", nullable: true },
    endDate: { name: "end_date", type: "text", nullable: true },
    accountId: { name: "account_id", type: Number, nullable: true },
    linkedAssetId: { name: "linked_asset_id", type: Number, nullable: true },
    isActive: { name: "is_active", type: Boolean, default: true },
    notes: { type: "text", nullable: true },
    createdAt,
  },
});
