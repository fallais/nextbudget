import { NextResponse } from "next/server";
import { assets } from "@infrastructure/persistence/repositories";
import { listAssets } from "@application/assets";
import { handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record a valuation snapshot (current value) for every visible active asset,
 * dated today. Feeds the net-worth-over-time chart.
 */
export async function POST() {
  return handle(async () => {
    const active = (await listAssets()).filter((a) => a.isActive);
    const date = new Date().toISOString().slice(0, 10);

    await assets.recordValuations(
      active.map((a) => ({ assetId: a.id, date, valueCents: a.valueCents })),
    );
    return NextResponse.json({ ok: true, recorded: active.length });
  });
}
