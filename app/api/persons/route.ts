import { NextResponse } from "next/server";
import { listPersons } from "@application/contributions";
import { createPerson } from "@application/household";
import { personInputSchema } from "@application/contracts/validation";
import { badRequest, conflict, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listPersons());
}

export async function POST(request: Request) {
  const parsed = personInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const result = await createPerson(parsed.data);
    if (!result.ok) return conflict("Ce compte utilisateur est déjà lié à une autre personne");
    return NextResponse.json(result.person, { status: 201 });
  });
}
