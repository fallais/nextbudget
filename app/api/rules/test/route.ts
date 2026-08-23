import { tryRule } from "@application/rules";
import { NextResponse } from "next/server";
import { ruleTestSchema } from "@application/contracts/validation";
import { compileRule } from "@application/categorize/engine";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = ruleTestSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const trial = await tryRule(parsed.data);
    return trial ? NextResponse.json(trial) : badRequest("Motif invalide");
  });
}
