import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { AssetEntity } from "@infrastructure/db/schemas";
import { assetInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { listAssets, replaceAssetOwners } from "@application/assets";
import { Ownership } from "@domain/value-objects/share";
import { isDomainError } from "@domain/errors";
import { Asset, type NewAsset } from "@domain/entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAssets());
}

export async function POST(request: Request) {
  const parsed = assetInputSchema.safeParse(await request.json());
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
  const ownerId = (await getCurrentUser())?.id ?? null;

  try {
    // The entity is the gate: nothing reaches the table that Asset.create()
    // would refuse — a liability typed "Immobilier", a negative value, a
    // nonsense term.
    const candidate = Asset.create({ ...assetData, ownerId, visibility: "shared" } as NewAsset);

    const created = await ds.transaction(async (manager) => {
      const repo = manager.getRepository(AssetEntity);
      const { id: _id, createdAt: _createdAt, ...values } = candidate.toRow();
      const asset = await repo.save(repo.create(values));
      if (owners) {
        const failure = await replaceAssetOwners(manager, asset.id, owners);
        if (failure) throw new Error(failure.error);
      }
      return asset;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
