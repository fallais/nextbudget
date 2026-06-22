import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { AssetEntity } from "@/lib/db/entities";
import { assetInputSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/db/assets";

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
  const ds = await getDataSource();
  const repo = ds.getRepository(AssetEntity);
  const created = await repo.save(
    repo.create({ ...parsed.data, ownerId: (await getCurrentUser())?.id ?? null }),
  );
  return NextResponse.json(created, { status: 201 });
}
