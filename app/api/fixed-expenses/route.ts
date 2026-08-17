import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { FixedExpenseEntity } from "@infrastructure/db/schemas";
import { fixedExpenseInputSchema } from "@domain/validation";
import { getCurrentUser } from "@application/auth";
import { getScope, applyOwnedScope } from "@application/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(FixedExpenseEntity)
    .createQueryBuilder("f")
    .orderBy("f.due_day", "ASC")
    .addOrderBy("f.name", "ASC");
  applyOwnedScope(qb, "f", await getScope());
  return NextResponse.json(await qb.getMany());
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = fixedExpenseInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  const repo = ds.getRepository(FixedExpenseEntity);
  const created = await repo.save(
    repo.create({
      ownerId: (await getCurrentUser())?.id ?? null,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      expectedAmountCents: parsed.data.expectedAmountCents,
      tolerancePct: parsed.data.tolerancePct,
      dueDay: parsed.data.dueDay,
      matchPattern: parsed.data.matchPattern,
      matchType: parsed.data.matchType,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes ?? null,
    }),
  );
  return NextResponse.json(created, { status: 201 });
}
