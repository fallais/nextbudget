import type { Entity } from "@domain/ddd";

/**
 * The static side of an entity class: the two doors a row can come through.
 *
 * `create` validates user input and is the only way new data enters. Trusting
 * `reconstitute` for reads is deliberate — a row already in the table was valid
 * when written, and re-validating on read would let a new rule retroactively
 * break old data (see `libs/domain/entities`).
 *
 * A repository implementation takes one of these instead of hard-coding a
 * class, which is what lets a single generic implementation serve every table.
 */
export interface EntityFactory<TEntity extends Entity<TRow>, TRow extends { id: number }, TNew> {
  create(input: TNew): TEntity;
  reconstitute(row: TRow): TEntity;
}
