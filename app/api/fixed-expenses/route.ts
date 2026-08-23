import { createFixedExpense } from "@application/fixed-expenses";
import { NextResponse } from "next/server";
import { listFixedExpenses } from "@application/fixed-expenses";
import { fixedExpenseInputSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listFixedExpenses());
}

export async function POST(request: Request) {
  const parsed = fixedExpenseInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await createFixedExpense(parsed.data);
    return NextResponse.json(created, { status: 201 });
  });
}
