import "server-only";
import type { UserRow } from "@domain/entities";
import { getSessionUser } from "@infrastructure/auth/session";
import { createSession } from "@infrastructure/auth/session";
import { verifyPassword } from "@infrastructure/auth/password";
import { settings, users } from "@infrastructure/persistence/repositories";
import type { SettingsRepository, UserRepository } from "@domain/repositories";

export type AuthDeps = {
  settings: Pick<SettingsRepository, "get" | "enableEnforcedAuth">;
  users: Pick<UserRepository, "findOwner">;
};

const LIVE_AUTH: AuthDeps = { settings, users };

export { createSession, destroySession, getSessionUser } from "@infrastructure/auth/session";
export { hashPassword, verifyPassword } from "@infrastructure/auth/password";

export type AuthMode = "open" | "enforced";

export async function getAuthMode(deps: AuthDeps = LIVE_AUTH): Promise<AuthMode> {
  return (await deps.settings.get("authMode")) === "enforced" ? "enforced" : "open";
}

/** Strip the password hash before returning a user over the wire. */
export function publicUser(u: UserRow) {
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

export async function getOwner(deps: AuthDeps = LIVE_AUTH): Promise<UserRow | null> {
  const owner = await deps.users.findOwner();
  return owner?.toRow() ?? null;
}

/**
 * The acting user.
 * - `open` mode: the single owner (no login required).
 * - `enforced` mode: the user behind a valid session cookie, or null.
 */
export async function getCurrentUser(deps: AuthDeps = LIVE_AUTH): Promise<UserRow | null> {
  const mode = await getAuthMode(deps);
  if (mode === "open") return getOwner(deps);
  return getSessionUser();
}

/**
 * Switch the household from `open` to `enforced` auth.
 *
 * Both writes belong together: setting the mode without storing the owner's
 * password would lock everyone out of an install that now demands a login
 * nobody can satisfy. The caller creates the session afterwards so the owner
 * who just enabled it stays signed in.
 */
export async function enableEnforcedAuth(
  ownerId: number,
  passwordHash: string,
  email?: string,
  deps: AuthDeps = LIVE_AUTH,
): Promise<void> {
  await deps.settings.enableEnforcedAuth(ownerId, passwordHash, email);
}

export type LoginDeps = {
  users: Pick<UserRepository, "findActiveByIdentifier">;
  verifyPassword: (hash: string, plain: string) => Promise<boolean>;
  createSession: (userId: number) => Promise<void>;
};

const LIVE_LOGIN: LoginDeps = { users, verifyPassword, createSession };

/**
 * Sign in, or refuse without saying why.
 *
 * One answer for every failure — unknown account, no password set, wrong
 * password — because distinguishing them turns the form into a way of asking
 * which names exist. That is a security property, and it belongs somewhere it
 * can be tested rather than in a route handler where the next edit can widen
 * it by accident.
 */
export async function login(
  identifier: string,
  password: string,
  deps: LoginDeps = LIVE_LOGIN,
): Promise<boolean> {
  const user = await deps.users.findActiveByIdentifier(identifier);
  const row = user?.toRow();
  if (!row?.passwordHash || !(await deps.verifyPassword(row.passwordHash, password))) {
    return false;
  }
  await deps.createSession(row.id);
  return true;
}
