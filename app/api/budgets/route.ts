import { NextResponse } from "next/server";
import { createBudget, getBudgetStatuses } from "@application/budgets";
import { budgetInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBudgetStatuses());
}

export async function POST(request: Request) {
  const parsed = budgetInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const created = await createBudget({
      categoryId: parsed.data.categoryId,
      amountCents: parsed.data.amountCents,
      period: parsed.data.period,
      ownerId: (await getCurrentUser())?.id ?? null,
    });
    return NextResponse.json(created, { status: 201 });
  }, "Cette catégorie a déjà un budget.");
}
