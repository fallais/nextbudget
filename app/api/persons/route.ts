import { NextResponse } from "next/server";
import { persons } from "@infrastructure/persistence/repositories";
import { listPersons } from "@application/contributions";
import { isUserLinkTaken } from "@application/household";
import { personInputSchema } from "@application/contracts/validation";
import { badRequest, conflict, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listPersons());
}

export async function POST(request: Request) {
  const parsed = personInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  const userId = parsed.data.userId ?? null;
  if (userId != null && (await isUserLinkTaken(userId))) {
    return conflict("Ce compte utilisateur est déjà lié à une autre personne");
  }

  return handle(async () => {
    const created = await persons.create({
      name: parsed.data.name,
      userId,
      monthlySalaryCents: parsed.data.monthlySalaryCents ?? null,
      matchPattern: parsed.data.matchPattern ?? null,
      matchType: parsed.data.matchType ?? "contains",
      tolerancePct: parsed.data.tolerancePct,
      isActive: parsed.data.isActive,
    });
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
