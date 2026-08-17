import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { AccountEntity } from "@infrastructure/db/schemas";
import { listAllAccounts } from "@application/queries";
import { accountInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAllAccounts());
}

export async function POST(request: Request) {
  const parsed = accountInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  const repo = ds.getRepository(AccountEntity);
  const created = await repo.save(
    repo.create({
      name: parsed.data.name,
      kind: parsed.data.kind,
      bank: parsed.data.bank ?? null,
      iban: parsed.data.iban ?? null,
      currency: parsed.data.currency,
      visibility: parsed.data.visibility,
      // An explicit owner wins; otherwise the account belongs to whoever
      // created it, matching how rules/contributions/assets are stamped.
      ownerId: parsed.data.ownerId ?? (await getCurrentUser())?.id ?? null,
    }),
  );
  return NextResponse.json(created, { status: 201 });
}
