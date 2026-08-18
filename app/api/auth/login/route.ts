import { NextResponse } from "next/server";
import { users } from "@infrastructure/persistence/repositories";
import { loginSchema } from "@application/contracts/validation";
import { verifyPassword, createSession } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  const { identifier, password } = parsed.data;

  return handle(async () => {
    const user = await users.findActiveByIdentifier(identifier);
    const row = user?.toRow();

    // One message for every failure — unknown account, no password set, wrong
    // password — so this cannot be used to probe which names exist.
    if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, password))) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    await createSession(row.id);
    return NextResponse.json({ ok: true });
  });
}
