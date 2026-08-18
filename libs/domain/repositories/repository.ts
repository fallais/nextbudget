import type { Entity } from "@domain/ddd";

/**
 * The persistence port.
 *
 * The domain says what it needs from storage; `libs/infrastructure/persistence`
 * says how Postgres provides it. Nothing in this folder imports TypeORM, which
 * is the whole point: the dependency points inward, so a use case can be tested
 * against an in-memory implementation and the domain never learns what a
 * `SelectQueryBuilder` is.
 *
 * One generic interface rather than ten near-identical ones. Ten hand-written
 * `AccountRepository`/`RuleRepository`/… interfaces that all declare the same
 * five methods is ceremony, not architecture; where a table genuinely needs
 * more than CRUD (transactions dedup on import, assets own their shares), that
 * repository extends this with the extra methods it actually needs.
 */
export interface Repository<TEntity extends Entity<TRow>, TRow extends { id: number }, TNew> {
  findById(id: number): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;

  /**
   * Validates through the entity's own `create()` factory before writing, so
   * an invariant cannot be bypassed by going straight to the table.
   */
  create(input: TNew): Promise<TEntity>;

  /**
   * Re-validates the *merged* result, not the patch: a partial update that
   * would leave the row invalid is rejected the same way a bad insert is.
   * Resolves `null` when no row has that id.
   */
  update(id: number, patch: Partial<TNew>): Promise<TEntity | null>;

  /** `false` when there was nothing to delete. */
  delete(id: number): Promise<boolean>;

  count(): Promise<number>;
}
