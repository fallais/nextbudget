import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { RuleEntity } from "@infrastructure/db/schemas";
import { ruleInputSchema } from "@domain/validation";
import { getCurrentUser } from "@application/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataSource();
  const rows = await ds.getRepository(RuleEntity).find({ order: { priority: "ASC" } });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ruleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  const repo = ds.getRepository(RuleEntity);
  const created = await repo.save(
    repo.create({ ...parsed.data, ownerId: (await getCurrentUser())?.id ?? null }),
  );
  return NextResponse.json(created, { status: 201 });
}
