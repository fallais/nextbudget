import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { TransactionEntity } from "@infrastructure/db/schemas";
import { updateTransactionSchema } from "@application/contracts/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const txId = Number.parseInt(id, 10);
  if (!Number.isFinite(txId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(TransactionEntity).update(txId, {
    categoryId: parsed.data.categoryId,
  });
  return NextResponse.json({ ok: true });
}
