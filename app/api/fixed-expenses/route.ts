import { NextResponse } from "next/server";
import { fixedExpenses } from "@infrastructure/persistence/repositories";
import { listFixedExpenses } from "@application/fixed-expenses";
import { fixedExpenseInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listFixedExpenses());
}

export async function POST(request: Request) {
  const parsed = fixedExpenseInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const created = await fixedExpenses.create({
      ownerId: (await getCurrentUser())?.id ?? null,
      visibility: "shared",
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      liabilityId: null,
      expectedAmountCents: parsed.data.expectedAmountCents,
      tolerancePct: parsed.data.tolerancePct,
      dueDay: parsed.data.dueDay,
      matchPattern: parsed.data.matchPattern,
      matchType: parsed.data.matchType,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
