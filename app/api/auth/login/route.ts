import { NextResponse } from "next/server";
import { loginSchema } from "@application/contracts/validation";
import { login } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  const { identifier, password } = parsed.data;

  return handle(async () => {
    // One message for every failure, decided by the use case: distinguishing
    // them would turn this into a way of asking which names exist.
    if (!(await login(identifier, password))) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  });
}
