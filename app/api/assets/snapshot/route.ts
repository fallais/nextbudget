import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { AssetValuationEntity } from "@/lib/db/entities";
import { listAssets } from "@/lib/db/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record a valuation snapshot (current value) for every visible active asset,
 * dated today. Feeds the net-worth-over-time chart.
 */
export async function POST() {
  const assets = (await listAssets()).filter((a) => a.isActive);
  if (assets.length === 0) {
    return NextResponse.json({ ok: true, recorded: 0 });
  }
  const ds = await getDataSource();
  const date = new Date().toISOString().slice(0, 10);
  await ds.getRepository(AssetValuationEntity).insert(
    assets.map((a) => ({ assetId: a.id, date, valueCents: a.valueCents })),
  );
  return NextResponse.json({ ok: true, recorded: assets.length });
}
