import "server-only";
import { users } from "@infrastructure/persistence/repositories";
import { hashPassword } from "@infrastructure/auth/password";
import type { UserRole } from "@domain/enums";
import type { UserRow } from "@domain/entities";
import type { UserRepository } from "@domain/repositories";
import type { z } from "zod";
import type { userInputSchema, userUpdateSchema } from "./contracts/validation";

/**
 * User administration, and the one rule that guards it.
 *
 * The household must always keep someone who can administer it: an install
 * whose last owner has been demoted, deactivated or deleted is one nobody can
 * configure again without `npm run auth:reset` on the server. Both paths below
 * check that before writing, which is why they are use cases rather than two
 * repository calls at the edge.
 */

export type UserDeps = {
  users: Pick<
    UserRepository,
    "findAll" | "findById" | "create" | "update" | "countActiveOwners" | "deleteWithReferences"
  >;
  /** Hashing is infrastructure's business; the use case only says when. */
  hashPassword: (plain: string) => Promise<string>;
};

const LIVE: UserDeps = { users, hashPassword };

export type UserInput = z.infer<typeof userInputSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export type LastOwnerGuard = { ok: true } | { ok: false; reason: "not_found" | "last_owner" };

/** Would this change leave the household with no active owner? */
async function wouldStrandHousehold(
  targetRole: string,
  demotes: boolean,
  deps: UserDeps,
): Promise<boolean> {
  if (targetRole !== "owner" || !demotes) return false;
  return (await deps.users.countActiveOwners()) <= 1;
}

export async function changeUserRole(
  userId: number,
  patch: { role?: UserRole; isActive?: boolean },
  deps: UserDeps = LIVE,
): Promise<LastOwnerGuard> {
  const target = await deps.users.findById(userId);
  if (!target) return { ok: false, reason: "not_found" };

  const demotes = (patch.role != null && patch.role !== "owner") || patch.isActive === false;
  if (await wouldStrandHousehold(target.toRow().role, demotes, deps)) {
    return { ok: false, reason: "last_owner" };
  }
  return { ok: true };
}

export async function listUsers(deps: UserDeps = LIVE): Promise<UserRow[]> {
  return (await deps.users.findAll()).map((u) => u.toRow());
}

export async function createUser(input: UserInput, deps: UserDeps = LIVE): Promise<UserRow> {
  const created = await deps.users.create({
    name: input.name,
    email: input.email ?? null,
    role: input.role,
    isActive: input.isActive,
    passwordHash: input.password ? await deps.hashPassword(input.password) : null,
  });
  return created.toRow();
}

export type UpdateUserResult =
  | { ok: true; user: UserRow }
  | { ok: false; reason: "not_found" | "last_owner" };

/**
 * Change a user, guarding the household's last owner on the way.
 *
 * The guard and the write were two steps at the edge, with the route free to
 * do one and forget the other. A password arriving in plain text is hashed
 * here rather than in the handler: what it is stored as is not a transport
 * concern.
 */
export async function updateUser(
  userId: number,
  patch: UserUpdate,
  deps: UserDeps = LIVE,
): Promise<UpdateUserResult> {
  const { password, ...rest } = patch;
  const guard = await changeUserRole(userId, rest, deps);
  if (!guard.ok) return guard;

  const updated = await deps.users.update(userId, {
    ...rest,
    ...(password ? { passwordHash: await deps.hashPassword(password) } : {}),
  });
  return updated ? { ok: true, user: updated.toRow() } : { ok: false, reason: "not_found" };
}

export async function deleteUser(
  userId: number,
  deps: UserDeps = LIVE,
): Promise<LastOwnerGuard> {
  const target = await deps.users.findById(userId);
  if (!target) return { ok: false, reason: "not_found" };

  if (await wouldStrandHousehold(target.toRow().role, true, deps)) {
    return { ok: false, reason: "last_owner" };
  }

  await deps.users.deleteWithReferences(userId);
  return { ok: true };
}
