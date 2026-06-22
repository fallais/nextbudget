import { NextResponse } from "next/server";
import { listAllAccounts } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAllAccounts());
}
