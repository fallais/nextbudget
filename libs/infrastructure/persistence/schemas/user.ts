import { EntitySchema } from "typeorm";
import type { UserRow } from "@domain/entities";
import { createdAt, id } from "./columns";

export const UserEntity = new EntitySchema<UserRow>({
  name: "users",
  columns: {
    id,
    name: { type: "text" },
    email: { type: "text", nullable: true, unique: true },
    passwordHash: { name: "password_hash", type: "text", nullable: true },
    role: { type: "text", default: "member" },
    isActive: { name: "is_active", type: Boolean, default: true },
    createdAt,
  },
});
