import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { BudgetEntity } from "@/lib/db/entities";
import { categoryBudgetSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const catId = Number.parseInt(id, 10);
  if (!Number.isFinite(catId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const body = await request.json();
  const parsed = categoryBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(BudgetEntity);
  // v0.1: one budget per category. Clear existing, then set if provided.
  await repo.delete({ categoryId: catId });
  if (parsed.data.budgetAmountCents !== null && parsed.data.budgetPeriod !== null) {
    await repo.save(
      repo.create({
        categoryId: catId,
        amountCents: parsed.data.budgetAmountCents,
        period: parsed.data.budgetPeriod,
        ownerId: (await getCurrentUser())?.id ?? null,
      }),
    );
  }
  return NextResponse.json({ ok: true });
}
