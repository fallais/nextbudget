import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { CategoryEntity, RuleEntity, BudgetEntity, TransactionEntity, FixedExpenseEntity } from "@infrastructure/db/schemas";
import { categoryInputSchema, patchSchema } from "@domain/validation";

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
  const parsed = patchSchema(categoryInputSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(CategoryEntity).update(catId, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const catId = Number.parseInt(id, 10);
  if (!Number.isFinite(catId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const ds = await getDataSource();
  // Preserve the old FK ON DELETE behaviour (no DB-level FKs with TypeORM here):
  // rules + budgets cascade; transactions + fixed_expenses set null.
  await ds.getRepository(RuleEntity).delete({ categoryId: catId });
  await ds.getRepository(BudgetEntity).delete({ categoryId: catId });
  await ds.getRepository(TransactionEntity).update({ categoryId: catId }, { categoryId: null });
  await ds.getRepository(FixedExpenseEntity).update({ categoryId: catId }, { categoryId: null });
  await ds.getRepository(CategoryEntity).delete(catId);
  return NextResponse.json({ ok: true });
}
