import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { AccountEntity, TransactionEntity } from "@/lib/db/entities";
import { accountUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accountId = parseId((await context.params).id);
  if (accountId === null) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const parsed = accountUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  await ds.getRepository(AccountEntity).update(accountId, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accountId = parseId((await context.params).id);
  if (accountId === null) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const ds = await getDataSource();

  // There are no DB-level FKs, so deleting an account with transactions would
  // orphan them silently rather than failing. Refuse, and say how many.
  const txCount = await ds.getRepository(TransactionEntity).countBy({ accountId });
  if (txCount > 0) {
    return NextResponse.json(
      {
        error: `Ce compte contient ${txCount} transaction${txCount > 1 ? "s" : ""}. Supprimez-les ou déplacez-les avant de supprimer le compte.`,
      },
      { status: 409 },
    );
  }

  await ds.getRepository(AccountEntity).delete(accountId);
  return NextResponse.json({ ok: true });
}
