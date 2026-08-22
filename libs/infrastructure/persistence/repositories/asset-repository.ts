import "server-only";
import { In, type EntityManager } from "typeorm";
import {
  Asset,
  Prepayment,
  type AssetRow,
  type NewAsset,
  type NewPrepayment,
  type PrepaymentRow,
} from "@domain/entities";
import { invariant } from "@domain/errors";
import type { AssetOwnerInput, AssetRepository } from "@domain/repositories";
import { getDataSource } from "@infrastructure/persistence/client";
import {
  AssetEntity,
  AssetOwnerEntity,
  AssetValuationEntity,
  PrepaymentEntity,
  FixedExpenseEntity,
  PersonEntity,
} from "@infrastructure/persistence/schemas";
import { TypeOrmRepository } from "./typeorm-repository";

/**
 * The asset aggregate, written atomically.
 *
 * Everything that spans more than one table runs inside `ds.transaction`, so a
 * failure part-way cannot leave an asset whose ownership shares no longer total
 * 100% — which the domain treats as impossible, and which no `CHECK` constraint
 * in this schema enforces.
 */
export class TypeOrmAssetRepository
  extends TypeOrmRepository<Asset, AssetRow, NewAsset>
  implements AssetRepository
{
  async createWithOwners(input: NewAsset, owners?: AssetOwnerInput[]): Promise<Asset> {
    // The entity is the gate: nothing reaches the table that Asset.create()
    // would refuse — a liability typed "Immobilier", a negative value, a
    // nonsense term.
    const candidate = Asset.create(input);
    const ds = await getDataSource();

    const saved = await ds.transaction(async (manager) => {
      const repo = manager.getRepository(AssetEntity);
      const { id: _id, createdAt: _createdAt, ...values } = candidate.toRow();
      const asset = await repo.save(repo.create(values));
      if (owners) await replaceOwners(manager, asset.id, owners);
      return asset;
    });

    return Asset.reconstitute(saved);
  }

  async updateWithOwners(
    id: number,
    patch: Partial<NewAsset>,
    owners?: AssetOwnerInput[],
  ): Promise<Asset | null> {
    const ds = await getDataSource();
    const existing = await ds.getRepository(AssetEntity).findOne({ where: { id } });
    if (!existing) return null;

    // Validate the asset as it will be, not the patch in isolation.
    const { id: _id, createdAt: _createdAt, ...current } = existing;
    Asset.create({ ...current, ...patch } as NewAsset);

    await ds.transaction(async (manager) => {
      if (Object.keys(patch).length > 0) {
        await manager.getRepository(AssetEntity).update(id, patch);
      }
      if (owners) await replaceOwners(manager, id, owners);
    });

    const updated = await ds.getRepository(AssetEntity).findOne({ where: { id } });
    return updated ? Asset.reconstitute(updated) : null;
  }

  async deleteWithDependents(id: number): Promise<boolean> {
    const ds = await getDataSource();
    return ds.transaction(async (manager) => {
      const existing = await manager.getRepository(AssetEntity).findOne({ where: { id } });
      if (!existing) return false;

      await manager.getRepository(AssetValuationEntity).delete({ assetId: id });
      await manager.getRepository(PrepaymentEntity).delete({ assetId: id });
      await manager.getRepository(AssetOwnerEntity).delete({ assetId: id });
      await manager
        .getRepository(FixedExpenseEntity)
        .update({ liabilityId: id }, { liabilityId: null });
      await manager.getRepository(AssetEntity).update({ linkedAssetId: id }, { linkedAssetId: null });
      await manager.getRepository(AssetEntity).delete(id);
      return true;
    });
  }

  async listPrepayments(assetIds: number[]): Promise<Map<number, PrepaymentRow[]>> {
    const out = new Map<number, PrepaymentRow[]>();
    if (assetIds.length === 0) return out;
    const ds = await getDataSource();
    const rows = await ds.getRepository(PrepaymentEntity).find({
      where: { assetId: In(assetIds) },
      order: { date: "ASC", id: "ASC" },
    });
    for (const row of rows) out.set(row.assetId, [...(out.get(row.assetId) ?? []), row]);
    return out;
  }

  async addPrepayment(input: NewPrepayment): Promise<Prepayment> {
    const ds = await getDataSource();
    // Through the entity, so an amount of zero or a malformed date is refused
    // here rather than quietly reshaping a schedule.
    const entity = Prepayment.create(input);
    const saved = await ds.getRepository(PrepaymentEntity).save(entity.toRow());
    return Prepayment.reconstitute(saved);
  }

  async deletePrepayment(assetId: number, prepaymentId: number): Promise<boolean> {
    const ds = await getDataSource();
    const res = await ds
      .getRepository(PrepaymentEntity)
      .delete({ id: prepaymentId, assetId });
    return (res.affected ?? 0) > 0;
  }

  async recordValuations(
    entries: { assetId: number; date: string; valueCents: number }[],
  ): Promise<void> {
    if (entries.length === 0) return;
    const ds = await getDataSource();
    await ds.getRepository(AssetValuationEntity).insert(entries);
  }
}

/**
 * Replace an asset's ownership rows.
 *
 * The caller has already validated the split through `Ownership`; what is
 * checked here is that every person exists, because a share pointing at a
 * deleted person would quietly vanish from every personal total while still
 * counting in the household one.
 */
async function replaceOwners(
  manager: EntityManager,
  assetId: number,
  owners: AssetOwnerInput[],
): Promise<void> {
  const personIds = owners.map((o) => o.personId);
  const found = await manager.getRepository(PersonEntity).findBy({ id: In(personIds) });
  invariant(found.length === personIds.length, "Personne introuvable.", "asset.owner_unknown");

  const repo = manager.getRepository(AssetOwnerEntity);
  await repo.delete({ assetId });
  await repo.save(
    owners.map((o) =>
      repo.create({
        assetId,
        personId: o.personId,
        shareBps: o.shareBps,
        insuranceMonthlyCents: o.insuranceMonthlyCents ?? null,
      }),
    ),
  );
}
