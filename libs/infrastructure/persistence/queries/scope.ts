import "server-only";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { AccountEntity } from "@infrastructure/persistence/schemas";
import type { Scope } from "@application/scope";

/**
 * Turning a visibility scope into SQL.
 *
 * The scope itself is a policy and lives in `@application/scope`: who is
 * acting, and whether the install enforces logins at all. Applying it is not —
 * it means appending a where clause to a query builder, which is TypeORM's
 * vocabulary and belongs on this side of the line.
 */

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
