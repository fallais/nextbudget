import { EntitySchema } from "typeorm";
import type { ContributionRow } from "@domain/entities";
import { bigintNumber, createdAt, id, owner } from "./columns";

export const ContributionEntity = new EntitySchema<ContributionRow>({
  name: "contributions",
  columns: {
    id,
    ...owner,
    personId: { name: "person_id", type: Number },
    name: { type: "text" },
    expectedAmountCents: {
      name: "expected_amount_cents",
      type: "bigint",
      transformer: bigintNumber,
    },
    matchPattern: { name: "match_pattern", type: "text" },
    matchType: { name: "match_type", type: "text", default: "contains" },
    tolerancePct: { name: "tolerance_pct", type: Number, default: 10 },
    isActive: { name: "is_active", type: Boolean, default: true },
    notes: { type: "text", nullable: true },
    createdAt,
  },
});
