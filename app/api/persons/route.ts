import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { PersonEntity } from "@/lib/db/entities";
import { listPersons } from "@/lib/db/contributions";
import { personInputSchema } from "@/lib/validation";

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
  const ds = await getDataSource();
  const repo = ds.getRepository(PersonEntity);
  const created = await repo.save(
    repo.create({
      name: parsed.data.name,
      monthlySalaryCents: parsed.data.monthlySalaryCents ?? null,
      matchPattern: parsed.data.matchPattern ?? null,
      matchType: parsed.data.matchType ?? "contains",
      tolerancePct: parsed.data.tolerancePct,
      isActive: parsed.data.isActive,
    }),
  );
  return NextResponse.json(created, { status: 201 });
}
