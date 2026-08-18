import { EntitySchema } from "typeorm";
import type { RuleRow } from "@domain/entities";
import { createdAt, id, owner } from "./columns";

export const RuleEntity = new EntitySchema<RuleRow>({
  name: "rules",
  columns: {
    id,
    ...owner,
    categoryId: { name: "category_id", type: Number },
    pattern: { type: "text" },
    matchType: { name: "match_type", type: "text", default: "contains" },
    amountCondition: { name: "amount_condition", type: "text", default: "any" },
    priority: { type: Number, default: 100 },
    isActive: { name: "is_active", type: Boolean, default: true },
    createdAt,
  },
  indices: [{ name: "rules_priority_idx", columns: ["priority"] }],
});
