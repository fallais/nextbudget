import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { PersonEntity, ContributionEntity } from "@infrastructure/db/schemas";
import { isUserLinkTaken } from "@application/household";
import { personInputSchema, patchSchema } from "@application/contracts/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number.parseInt(id, 10);
  if (!Number.isFinite(personId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const body = await request.json();
  const parsed = patchSchema(personInputSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  if (parsed.data.userId != null && (await isUserLinkTaken(parsed.data.userId, personId))) {
    return NextResponse.json(
      { error: "Ce compte utilisateur est déjà lié à une autre personne" },
      { status: 409 },
    );
  }
  const ds = await getDataSource();
  await ds.getRepository(PersonEntity).update(personId, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number.parseInt(id, 10);
  if (!Number.isFinite(personId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const ds = await getDataSource();
  // Preserve the old FK cascade: contributions belong to a person.
  await ds.getRepository(ContributionEntity).delete({ personId });
  await ds.getRepository(PersonEntity).delete(personId);
  return NextResponse.json({ ok: true });
}
