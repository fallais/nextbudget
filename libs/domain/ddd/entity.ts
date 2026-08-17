/**
 * Something with an identity that persists through change.
 *
 * The distinction that matters: an entity is the *same* entity when its id
 * matches, even if every other field differs — renaming an account does not
 * make it another account. Value objects are the opposite; see
 * `./value-object`.
 *
 * The row is held privately and exposed through `toRow()`. That is not
 * ceremony here: TypeORM hydrates plain objects and React Server Components
 * flatten anything crossing to the client, so the row is the shape that
 * actually travels, while the class is where behaviour and invariants live on
 * the server.
 */
export abstract class Entity<TRow extends { id: number }> {
  protected constructor(protected readonly row: TRow) {}

  get id(): number {
    return this.row.id;
  }

  /** Unsaved entities have no identity yet, so they are equal to nothing. */
  get isPersisted(): boolean {
    return this.row.id > 0;
  }

  equals(other: Entity<TRow> | null | undefined): boolean {
    if (!other) return false;
    if (other === this) return true;
    if (other.constructor !== this.constructor) return false;
    return this.isPersisted && other.isPersisted && this.id === other.id;
  }

  /** The persisted shape — also the DTO handed to the UI. */
  toRow(): TRow {
    return { ...this.row };
  }
}
