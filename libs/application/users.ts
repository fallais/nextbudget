import "server-only";
import { users } from "@infrastructure/persistence/repositories";
import type { UserRole } from "@domain/enums";

/**
 * User administration, and the one rule that guards it.
 *
 * The household must always keep someone who can administer it: an install
 * whose last owner has been demoted, deactivated or deleted is one nobody can
 * configure again without `npm run auth:reset` on the server. Both paths below
 * check that before writing, which is why they are use cases rather than two
 * repository calls at the edge.
 */

export type LastOwnerGuard = { ok: true } | { ok: false; reason: "not_found" | "last_owner" };

/** Would this change leave the household with no active owner? */
async function wouldStrandHousehold(
  targetRole: string,
  demotes: boolean,
): Promise<boolean> {
  if (targetRole !== "owner" || !demotes) return false;
  return (await users.countActiveOwners()) <= 1;
}

export async function changeUserRole(
  userId: number,
  patch: { role?: UserRole; isActive?: boolean },
): Promise<LastOwnerGuard> {
  const target = await users.findById(userId);
  if (!target) return { ok: false, reason: "not_found" };

  const demotes = (patch.role != null && patch.role !== "owner") || patch.isActive === false;
  if (await wouldStrandHousehold(target.toRow().role, demotes)) {
    return { ok: false, reason: "last_owner" };
  }
  return { ok: true };
}

export async function deleteUser(userId: number): Promise<LastOwnerGuard> {
  const target = await users.findById(userId);
  if (!target) return { ok: false, reason: "not_found" };

  if (await wouldStrandHousehold(target.toRow().role, true)) {
    return { ok: false, reason: "last_owner" };
  }

  await users.deleteWithReferences(userId);
  return { ok: true };
}
