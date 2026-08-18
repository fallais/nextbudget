import { EntitySchema } from "typeorm";
import type { CategoryRow } from "@domain/entities";
import { createdAt, id } from "./columns";

export const CategoryEntity = new EntitySchema<CategoryRow>({
  name: "categories",
  columns: {
    id,
    name: { type: "text", unique: true },
    color: { type: "text", default: "#6b7280" },
    icon: { type: "text", default: "Tag" },
    isDefault: { name: "is_default", type: Boolean, default: false },
    createdAt,
  },
});
