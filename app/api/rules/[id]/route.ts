import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { RuleEntity } from "@infrastructure/db/schemas";
import { ruleInputSchema, patchSchema } from "@application/contracts/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ruleId = Number.parseInt(id, 10);
  if (!Number.isFinite(ruleId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const body = await request.json();
  const parsed = patchSchema(ruleInputSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(RuleEntity).update(ruleId, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ruleId = Number.parseInt(id, 10);
  if (!Number.isFinite(ruleId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(RuleEntity).delete(ruleId);
  return NextResponse.json({ ok: true });
}
