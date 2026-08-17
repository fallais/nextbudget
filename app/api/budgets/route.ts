import { NextResponse } from "next/server";
import { getBudgetStatuses } from "@application/budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const statuses = await getBudgetStatuses();
  return NextResponse.json(statuses);
}
