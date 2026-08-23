import { NextResponse } from "next/server";
import { detectTransfers } from "@application/transfers";
import { transferDetectSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Look for pairs nobody has declared, over a span or the whole ledger.
 *
 * Imports do this on their own; this is for the statements imported before
 * the app knew what a transfer was.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const parsed = transferDetectSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => NextResponse.json(await detectTransfers(parsed.data)));
}
