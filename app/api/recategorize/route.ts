import { NextResponse } from "next/server";
import { recategorizeAll } from "@/lib/categorize/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const onlyUncategorized = url.searchParams.get("only") === "uncategorized";
    const result = await recategorizeAll({ onlyUncategorized });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
