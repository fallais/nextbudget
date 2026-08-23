import "server-only";

/**
 * Spending figures for the dashboard.
 *
 * Deliberately thin. Every one of these is a read model: a query that shapes
 * rows for a screen, with no aggregate to rebuild and no rule to enforce on
 * the way out. Inventing an entity per stat tile to give this file something
 * to do would be ceremony, so the queries live in
 * `@infrastructure/persistence/queries/stats` and this re-exports them.
 *
 * What it buys is the boundary: `app/` imports `@application`, never the
 * query layer, so replacing how these are computed stays an infrastructure
 * change. The command side is the opposite — writes go through repositories
 * and entities, because there the invariants are real.
 */
export * from "@infrastructure/persistence/queries/stats";
