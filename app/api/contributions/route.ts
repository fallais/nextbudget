import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { ContributionEntity } from "@/lib/db/entities";
import { listContributions } from "@/lib/db/contributions";
import { contributionInputSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listContributions();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = contributionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  const repo = ds.getRepository(ContributionEntity);
  const created = await repo.save(
    repo.create({
      ownerId: (await getCurrentUser())?.id ?? null,
      personId: parsed.data.personId,
      name: parsed.data.name,
      expectedAmountCents: parsed.data.expectedAmountCents,
      matchPattern: parsed.data.matchPattern,
      matchType: parsed.data.matchType,
      tolerancePct: parsed.data.tolerancePct,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes ?? null,
    }),
  );
  return NextResponse.json(created, { status: 201 });
}
