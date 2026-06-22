import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { CategoryEntity } from "@/lib/db/entities";
import { categoryBudgetSchema } from "@/lib/validation";

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
  await ds.getRepository(CategoryEntity).update(catId, {
    budgetAmountCents: parsed.data.budgetAmountCents,
    budgetPeriod: parsed.data.budgetPeriod,
  });
  return NextResponse.json({ ok: true });
}
