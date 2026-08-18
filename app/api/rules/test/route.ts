import { NextResponse } from "next/server";
import { transactions } from "@infrastructure/persistence/repositories";
import { ruleTestSchema } from "@application/contracts/validation";
import { compileRule } from "@application/categorize/engine";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = ruleTestSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: parsed.data.pattern,
    matchType: parsed.data.matchType,
    amountCondition: parsed.data.amountCondition,
    priority: 0,
  });
  if (!compiled) return badRequest("Motif invalide");

  return handle(async () => {
    const all = (await transactions.findAll()).map((t) => t.toRow());
    const matches = all.filter((t) => compiled.test(t.normalizedDescription, t.amountCents));

    return NextResponse.json({
      matchCount: matches.length,
      total: all.length,
      samples: matches.slice(0, 5).map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amountCents: t.amountCents,
      })),
    });
  });
}
