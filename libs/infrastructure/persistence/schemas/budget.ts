import { EntitySchema } from "typeorm";
import type { BudgetRow } from "@domain/entities";
import { bigintNumber, createdAt, id, owner } from "./columns";

export const BudgetEntity = new EntitySchema<BudgetRow>({
  name: "budgets",
  columns: {
    id,
    categoryId: { name: "category_id", type: Number },
    ...owner,
    amountCents: { name: "amount_cents", type: "bigint", transformer: bigintNumber },
    period: { type: "text", default: "monthly" },
    createdAt,
  },
  indices: [
    {
      name: "budgets_cat_owner_period_uniq",
      columns: ["categoryId", "ownerId", "period"],
      unique: true,
    },
  ],
});
