import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { AccountEntity } from "@/lib/db/entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataSource();
  const rows = await ds.getRepository(AccountEntity).find({ order: { name: "ASC" } });
  return NextResponse.json(rows);
}
