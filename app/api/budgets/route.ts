import { NextResponse } from "next/server";
import { getBudgetStatuses } from "@/lib/db/budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const statuses = await getBudgetStatuses();
  return NextResponse.json(statuses);
}
