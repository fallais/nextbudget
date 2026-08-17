import "server-only";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { getDataSource } from "@infrastructure/db/client";
import { AccountEntity } from "@infrastructure/db/schemas";
import { getAuthMode, getCurrentUser } from "@application/auth";

/**
 * Visibility scope for the current request.
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

/** Restrict an owned table (alias must expose owner_id + visibility) to the scope. */
export function applyOwnedScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  scope: Scope,
): SelectQueryBuilder<T> {
  if (scope.scoped) {
    qb.andWhere(
      `(${alias}.owner_id = :scopeMe OR ${alias}.visibility = 'shared' OR ${alias}.owner_id IS NULL)`,
      { scopeMe: scope.userId },
    );
  }
  return qb;
}

/**
 * Account ids visible to the scope, or `null` meaning "no restriction" (open mode).
 * Transactions/stats inherit visibility from their account.
 */
export async function visibleAccountIds(scope: Scope): Promise<number[] | null> {
  if (!scope.scoped) return null;
  const ds = await getDataSource();
  const qb = ds.getRepository(AccountEntity).createQueryBuilder("a").select("a.id", "id");
  applyOwnedScope(qb, "a", scope);
  const rows = await qb.getRawMany<{ id: number }>();
  return rows.map((r) => Number(r.id));
}

/** Restrict a transactions query (given alias) to a set of account ids. */
export function applyAccountScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  accountIds: number[] | null,
): SelectQueryBuilder<T> {
  if (accountIds !== null) {
    // Empty list ⇒ match nothing (sentinel -1 keeps the IN clause valid).
    qb.andWhere(`${alias}.account_id IN (:...scopeAccIds)`, {
      scopeAccIds: accountIds.length ? accountIds : [-1],
    });
  }
  return qb;
}
