import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import {
  AssetEntity,
  AssetOwnerEntity,
  AssetValuationEntity,
  FixedExpenseEntity,
} from "@/lib/db/entities";
import { assetUpdateSchema } from "@/lib/validation";
import { replaceAssetOwners } from "@/lib/db/assets";
import { shareErrorMessage, validateShares } from "@/lib/shares";

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
  if (owners) {
    const invalid = validateShares(owners);
    if (invalid) {
      return NextResponse.json({ error: shareErrorMessage(invalid) }, { status: 400 });
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
