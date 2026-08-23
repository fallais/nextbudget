import { NextResponse } from "next/server";
import { createAccount } from "@application/accounts";
import { listAllAccounts } from "@application/queries";
import { accountInputSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAllAccounts());
}

export async function POST(request: Request) {
  const parsed = accountInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await createAccount(parsed.data);
    return NextResponse.json(created, { status: 201 });
  });
}
