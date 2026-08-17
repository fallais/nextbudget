import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { FixedExpenseEntity } from "@/lib/db/entities";
import { fixedExpenseInputSchema, patchSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const fxId = Number.parseInt(id, 10);
  if (!Number.isFinite(fxId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const body = await request.json();
  const parsed = patchSchema(fixedExpenseInputSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(FixedExpenseEntity).update(fxId, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const fxId = Number.parseInt(id, 10);
  if (!Number.isFinite(fxId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(FixedExpenseEntity).delete(fxId);
  return NextResponse.json({ ok: true });
}
