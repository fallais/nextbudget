import "server-only";
import { getDataSource } from "@infrastructure/db/client";
import { SettingEntity, UserEntity } from "@infrastructure/db/schemas";
import type { User } from "@domain/entities";
import { getSessionUser } from "@infrastructure/auth/session";

export { createSession, destroySession, getSessionUser } from "@infrastructure/auth/session";
export { hashPassword, verifyPassword } from "@infrastructure/auth/password";

export type AuthMode = "open" | "enforced";

export async function getAuthMode(): Promise<AuthMode> {
  const ds = await getDataSource();
  const row = await ds.getRepository(SettingEntity).findOne({ where: { key: "authMode" } });
  return row?.value === "enforced" ? "enforced" : "open";
}

/** Strip the password hash before returning a user over the wire. */
export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    hasPassword: !!u.passwordHash,
  };
}

export async function getOwner(): Promise<User | null> {
  const ds = await getDataSource();
  return ds.getRepository(UserEntity).findOne({ where: { role: "owner" } });
}

/**
 * The acting user.
 * - `open` mode: the single owner (no login required).
 * - `enforced` mode: the user behind a valid session cookie, or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const mode = await getAuthMode();
  if (mode === "open") return getOwner();
  return getSessionUser();
}
