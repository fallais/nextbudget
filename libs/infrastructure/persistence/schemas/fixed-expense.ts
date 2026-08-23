import { EntitySchema } from "typeorm";
import type { FixedExpenseRow } from "@domain/entities";
import { bigintNumber, createdAt, id, owner } from "./columns";

export const FixedExpenseEntity = new EntitySchema<FixedExpenseRow>({
  name: "fixed_expenses",
  columns: {
    id,
    ...owner,
    name: { type: "text" },
    categoryId: { name: "category_id", type: Number, nullable: true },
    liabilityId: { name: "liability_id", type: Number, nullable: true },
    expectedAmountCents: {
      name: "expected_amount_cents",
      type: "bigint",
      transformer: bigintNumber,
    },
    tolerancePct: { name: "tolerance_pct", type: Number, default: 10 },
    // Defaulted, so the charges recorded before cadences existed stay what they
    // were: every one of them was monthly by construction.
    cadence: { type: "text", default: "monthly" },
    dueDay: { name: "due_day", type: Number, nullable: true },
    dueMonth: { name: "due_month", type: Number, nullable: true },
    matchPattern: { name: "match_pattern", type: "text" },
    matchType: { name: "match_type", type: "text", default: "contains" },
    isActive: { name: "is_active", type: Boolean, default: true },
    notes: { type: "text", nullable: true },
    createdAt,
  },
});
