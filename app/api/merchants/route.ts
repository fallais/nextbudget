import { NextResponse } from "next/server";
import { listMerchants } from "@application/categorize/merchants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listMerchants());
}
