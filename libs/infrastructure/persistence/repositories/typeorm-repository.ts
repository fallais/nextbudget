import "server-only";
import type {
  DeepPartial,
  EntitySchema,
  FindOptionsOrder,
  ObjectLiteral,
  Repository as TypeOrmRepo,
} from "typeorm";
import type { Entity } from "@domain/ddd";
import type { EntityFactory, Repository } from "@domain/repositories";
import { getDataSource } from "@infrastructure/persistence/client";

/**
 * The one adapter behind every table.
 *
 * TypeORM hydrates plain rows from an `EntitySchema`, never class instances, so
 * this is the seam where a row becomes a domain object and back again. Reads go
 * through `reconstitute` (trusting stored data), writes through `create`
 * (validating it) — which is what makes the entity factories unbypassable
 * rather than decorative.
 */
export class TypeOrmRepository<
  TEntity extends Entity<TRow>,
  TRow extends ObjectLiteral & { id: number },
  TNew,
> implements Repository<TEntity, TRow, TNew>
{
  constructor(
    protected readonly schema: EntitySchema<TRow>,
    protected readonly factory: EntityFactory<TEntity, TRow, TNew>,
    /** Default list order, e.g. `{ name: "ASC" }`. */
    protected readonly defaultOrder?: FindOptionsOrder<TRow>,
  ) {}

  protected async repo(): Promise<TypeOrmRepo<TRow>> {
    return (await getDataSource()).getRepository(this.schema);
  }

  async findById(id: number): Promise<TEntity | null> {
    const row = await (await this.repo()).findOne({ where: { id } as never });
    return row ? this.factory.reconstitute(row) : null;
  }

  async findAll(): Promise<TEntity[]> {
    const rows = await (await this.repo()).find({ order: this.defaultOrder });
    return rows.map((row) => this.factory.reconstitute(row));
  }

  async create(input: TNew): Promise<TEntity> {
    // The invariants run here, before anything touches Postgres.
    const entity = this.factory.create(input);
    const repo = await this.repo();
    // The casts are the price of one generic adapter: TypeORM's `create`/`save`
    // overloads cannot narrow against an unresolved TRow, though the runtime
    // shape is exactly the row minus its generated columns.
    const draft = repo.create(stripGenerated(entity.toRow()) as DeepPartial<TRow>);
    const saved = (await repo.save(draft as DeepPartial<TRow>)) as TRow;
    return this.factory.reconstitute(saved);
  }

  async update(id: number, patch: Partial<TNew>): Promise<TEntity | null> {
    const repo = await this.repo();
    const existing = await repo.findOne({ where: { id } as never });
    if (!existing) return null;

    // Validate the row as it will be *after* the patch. Checking the patch
    // alone would let a two-field invariant (a liability needing a loan type,
    // say) be broken by updating only one of them.
    const merged = { ...stripGenerated(existing), ...patch } as TNew;
    this.factory.create(merged);

    await repo.update(id, patch as never);
    const updated = await repo.findOne({ where: { id } as never });
    return updated ? this.factory.reconstitute(updated) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await (await this.repo()).delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(): Promise<number> {
    return (await this.repo()).count();
  }
}

/**
 * Drop the columns Postgres owns. `id` is a sequence and `created_at` is a
 * `createDate` column, so sending either on insert would either collide with
 * the sequence or overwrite the real creation time on update.
 */
function stripGenerated<TRow extends { id: number }>(row: TRow): Omit<TRow, "id" | "createdAt"> {
  const { id: _id, createdAt: _createdAt, ...rest } = row as TRow & { createdAt?: unknown };
  return rest as Omit<TRow, "id" | "createdAt">;
}
