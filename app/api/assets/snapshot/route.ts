import { NextResponse } from "next/server";
import { recordSnapshot } from "@application/assets";
import { handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record a valuation snapshot (current value) for every visible active asset,
 * dated today. Feeds the net-worth-over-time chart.
 */
export async function POST() {
  return handle(async () => {
    return NextResponse.json({ ok: true, recorded: await recordSnapshot() });
  });
}
