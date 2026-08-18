import { EntitySchema } from "typeorm";
import type { SessionRow } from "@domain/entities";

export const SessionEntity = new EntitySchema<SessionRow>({
  name: "sessions",
  columns: {
    id: { type: "text", primary: true },
    userId: { name: "user_id", type: Number },
    expiresAt: { name: "expires_at", type: "timestamptz" },
  },
  indices: [{ name: "sessions_user_idx", columns: ["userId"] }],
});
