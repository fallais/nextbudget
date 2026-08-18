import { NextResponse } from "next/server";
import { contributions } from "@infrastructure/persistence/repositories";
import { listContributions } from "@application/contributions";
import { contributionInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listContributions());
}

export async function POST(request: Request) {
  const parsed = contributionInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const created = await contributions.create({
      ownerId: (await getCurrentUser())?.id ?? null,
      visibility: "shared",
      personId: parsed.data.personId,
      name: parsed.data.name,
      expectedAmountCents: parsed.data.expectedAmountCents,
      matchPattern: parsed.data.matchPattern,
      matchType: parsed.data.matchType,
      tolerancePct: parsed.data.tolerancePct,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
