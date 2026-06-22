import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { TransactionEntity } from "@/lib/db/entities";
import { ruleTestSchema } from "@/lib/validation";
import { compileRule } from "@/lib/categorize/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ruleTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const compiled = compileRule({
    id: 0,
    categoryId: 0,
    pattern: parsed.data.pattern,
    matchType: parsed.data.matchType,
    amountCondition: parsed.data.amountCondition,
    priority: 0,
  });
  if (!compiled) {
    return NextResponse.json({ error: "Motif invalide" }, { status: 400 });
  }

  const ds = await getDataSource();
  const all = await ds.getRepository(TransactionEntity).find();
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
}
