import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { PersonEntity } from "@infrastructure/db/schemas";
import { listPersons } from "@application/contributions";
import { isUserLinkTaken } from "@application/household";
import { personInputSchema } from "@domain/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listPersons();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = personInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const userId = parsed.data.userId ?? null;
  if (userId != null && (await isUserLinkTaken(userId))) {
    return NextResponse.json(
      { error: "Ce compte utilisateur est déjà lié à une autre personne" },
      { status: 409 },
    );
  }
  const ds = await getDataSource();
  const repo = ds.getRepository(PersonEntity);
  const created = await repo.save(
    repo.create({
      name: parsed.data.name,
      userId,
      monthlySalaryCents: parsed.data.monthlySalaryCents ?? null,
      matchPattern: parsed.data.matchPattern ?? null,
      matchType: parsed.data.matchType ?? "contains",
      tolerancePct: parsed.data.tolerancePct,
      isActive: parsed.data.isActive,
    }),
  );
  return NextResponse.json(created, { status: 201 });
}
