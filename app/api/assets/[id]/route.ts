import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { AssetEntity, AssetValuationEntity, FixedExpenseEntity } from "@/lib/db/entities";
import { assetUpdateSchema } from "@/lib/validation";

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
  const ds = await getDataSource();
  await ds.getRepository(AssetEntity).update(id, parsed.data);
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
  // Reproduce the old FK behaviour: valuations cascade; fixed-expense link set null.
  await ds.getRepository(AssetValuationEntity).delete({ assetId: id });
  await ds.getRepository(FixedExpenseEntity).update({ liabilityId: id }, { liabilityId: null });
  await ds.getRepository(AssetEntity).delete(id);
  return NextResponse.json({ ok: true });
}
