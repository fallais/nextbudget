import { NextResponse } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/client";
import {
  AccountEntity,
  AssetEntity,
  BudgetEntity,
  ContributionEntity,
  FixedExpenseEntity,
  RuleEntity,
} from "@/lib/db/entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["account", "asset", "budget", "contribution", "fixedExpense", "rule"]),
  id: z.number().int().positive(),
  visibility: z.enum(["private", "shared"]),
});

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { kind, id, visibility } = parsed.data;
  const ds = await getDataSource();

  // Concrete per-entity updates keep the types clean (no EntitySchema union).
  switch (kind) {
    case "account":
      await ds.getRepository(AccountEntity).update(id, { visibility });
      break;
    case "asset":
      await ds.getRepository(AssetEntity).update(id, { visibility });
      break;
    case "budget":
      await ds.getRepository(BudgetEntity).update(id, { visibility });
      break;
    case "contribution":
      await ds.getRepository(ContributionEntity).update(id, { visibility });
      break;
    case "fixedExpense":
      await ds.getRepository(FixedExpenseEntity).update(id, { visibility });
      break;
    case "rule":
      await ds.getRepository(RuleEntity).update(id, { visibility });
      break;
  }
  return NextResponse.json({ ok: true });
}
