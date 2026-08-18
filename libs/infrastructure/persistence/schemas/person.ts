import { EntitySchema } from "typeorm";
import type { PersonRow } from "@domain/entities";
import { bigintNumber, createdAt, id } from "./columns";

export const PersonEntity = new EntitySchema<PersonRow>({
  name: "persons",
  columns: {
    id,
    userId: { name: "user_id", type: Number, nullable: true },
    name: { type: "text" },
    monthlySalaryCents: {
      name: "monthly_salary_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    matchPattern: { name: "match_pattern", type: "text", nullable: true },
    matchType: { name: "match_type", type: "text", nullable: true, default: "contains" },
    tolerancePct: { name: "tolerance_pct", type: Number, default: 5 },
    isActive: { name: "is_active", type: Boolean, default: true },
    createdAt,
  },
});
