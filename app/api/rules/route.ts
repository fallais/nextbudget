import { createRule, listRules } from "@application/rules";
import { NextResponse } from "next/server";
import { ruleInputSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listRules());
}

export async function POST(request: Request) {
  const parsed = ruleInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await createRule(parsed.data);
    return NextResponse.json(created, { status: 201 });
  });
}
