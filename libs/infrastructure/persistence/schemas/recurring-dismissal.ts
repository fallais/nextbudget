import { EntitySchema } from "typeorm";
import type { RecurringDismissalRow } from "@domain/entities";
import { createdAt, id } from "./columns";

export const RecurringDismissalEntity = new EntitySchema<RecurringDismissalRow>({
  name: "recurring_dismissals",
  columns: {
    id,
    key: { type: "text" },
    createdAt,
  },
  indices: [
    // Refusing the same suggestion twice is the same refusal, and a second row
    // would only make restoring it a partial undo.
    { name: "recurring_dismissals_key_uniq", columns: ["key"], unique: true },
  ],
});
