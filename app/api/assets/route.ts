import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { AssetEntity } from "@infrastructure/db/schemas";
import { assetInputSchema } from "@domain/validation";
import { getCurrentUser } from "@application/auth";
import { listAssets, replaceAssetOwners } from "@application/assets";
import { shareErrorMessage, validateShares } from "@domain/shares";

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

  if (owners) {
    const invalid = validateShares(owners);
    if (invalid) {
      return NextResponse.json({ error: shareErrorMessage(invalid) }, { status: 400 });
    }
  }

  const ds = await getDataSource();
  const ownerId = (await getCurrentUser())?.id ?? null;

  try {
    const created = await ds.transaction(async (manager) => {
      const repo = manager.getRepository(AssetEntity);
      const asset = await repo.save(repo.create({ ...assetData, ownerId }));
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
