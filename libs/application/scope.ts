import "server-only";
import { getAuthMode, getCurrentUser } from "@application/auth";

/**
 * Who is looking, and whether that restricts anything.
 *
 * The policy only. Applying it to a query is `@infrastructure/persistence/
 * queries/scope`, because that means appending a where clause in TypeORM's
 * vocabulary and this layer does not speak it.
 *
 * - `open` mode → `scoped: false` (single owner sees everything; all helpers no-op).
 * - `enforced` mode → `scoped: true` with the acting user's id (or -1 if none,
 *   which then only matches shared/unowned rows).
 */
export type Scope = { scoped: boolean; userId: number | null };

export async function getScope(): Promise<Scope> {
  if ((await getAuthMode()) === "open") return { scoped: false, userId: null };
  const user = await getCurrentUser();
  return { scoped: true, userId: user?.id ?? -1 };
}
