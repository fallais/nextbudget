import { NextResponse } from "next/server";
import { accounts } from "@infrastructure/persistence/repositories";
import { listAllAccounts } from "@application/queries";
import { accountInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAllAccounts());
}

export async function POST(request: Request) {
  const parsed = accountInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const created = await accounts.create({
      name: parsed.data.name,
      kind: parsed.data.kind,
      bank: parsed.data.bank ?? null,
      iban: parsed.data.iban ?? null,
      currency: parsed.data.currency,
      openingBalanceCents: parsed.data.openingBalanceCents ?? null,
      openingBalanceDate: parsed.data.openingBalanceDate ?? null,
      visibility: parsed.data.visibility,
      // An explicit owner wins; otherwise the account belongs to whoever
      // created it, matching how rules/contributions/assets are stamped.
      ownerId: parsed.data.ownerId ?? (await getCurrentUser())?.id ?? null,
    });
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
