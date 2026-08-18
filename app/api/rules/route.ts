import { NextResponse } from "next/server";
import { rules } from "@infrastructure/persistence/repositories";
import { ruleInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const all = await rules.findAll();
  return NextResponse.json(all.map((r) => r.toRow()));
}

export async function POST(request: Request) {
  const parsed = ruleInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const created = await rules.create({
      ...parsed.data,
      ownerId: (await getCurrentUser())?.id ?? null,
      // Rules are shared config, not per-person data — the scope helpers never
      // filter them. Previously this rode on the column default; the entity
      // requires it, so it is stated.
      visibility: "shared",
    });
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
