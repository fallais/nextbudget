import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { AssetEntity, AssetOwnerEntity, AssetValuationEntity, FixedExpenseEntity } from "@infrastructure/db/schemas";
import { assetUpdateSchema } from "@application/contracts/validation";
import { replaceAssetOwners } from "@application/assets";
import { Ownership } from "@domain/value-objects/share";
import { isDomainError } from "@domain/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const parsed = assetUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { owners, ...assetData } = parsed.data;
  // Ownership validates itself: a set that does not total 100% cannot be
  // constructed, so an invalid split never reaches the database.
  if (owners) {
    try {
      Ownership.fromRows(owners);
    } catch (err) {
      if (isDomainError(err)) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const ds = await getDataSource();
  try {
    await ds.transaction(async (manager) => {
      if (Object.keys(assetData).length > 0) {
        await manager.getRepository(AssetEntity).update(id, assetData);
      }
      if (owners) {
        const failure = await replaceAssetOwners(manager, id, owners);
        if (failure) throw new Error(failure.error);
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const ds = await getDataSource();
  // Reproduce the old FK behaviour: valuations and ownership rows cascade;
  // fixed-expense and asset↔liability links are set null.
  await ds.getRepository(AssetValuationEntity).delete({ assetId: id });
  await ds.getRepository(AssetOwnerEntity).delete({ assetId: id });
  await ds.getRepository(FixedExpenseEntity).update({ liabilityId: id }, { liabilityId: null });
  await ds.getRepository(AssetEntity).update({ linkedAssetId: id }, { linkedAssetId: null });
  await ds.getRepository(AssetEntity).delete(id);
  return NextResponse.json({ ok: true });
}
