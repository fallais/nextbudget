import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { FixedExpenseEntity } from "@/lib/db/entities";
import { fixedExpenseInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataSource();
  const rows = await ds
    .getRepository(FixedExpenseEntity)
    .find({ order: { dueDay: "ASC", name: "ASC" } });
  return NextResponse.json(rows);
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
