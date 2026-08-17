import { NextResponse } from "next/server";
import { listTransactions } from "@application/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIntList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;
  const result = await listTransactions(
    {
      from: sp.get("from"),
      to: sp.get("to"),
      categoryIds: parseIntList(sp.get("categoryIds")),
      accountIds: parseIntList(sp.get("accountIds")),
      uncategorized: sp.get("uncategorized") === "1",
      search: sp.get("search") ?? undefined,
      amountMin: sp.get("amountMin")
        ? Number.parseInt(sp.get("amountMin")!, 10)
        : undefined,
      amountMax: sp.get("amountMax")
        ? Number.parseInt(sp.get("amountMax")!, 10)
        : undefined,
    },
    {
      page: Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1),
      pageSize: Math.min(
        500,
        Math.max(1, Number.parseInt(sp.get("pageSize") ?? "50", 10) || 50),
      ),
    },
  );
  return NextResponse.json(result);
}
