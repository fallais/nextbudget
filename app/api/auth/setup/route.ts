import { NextResponse } from "next/server";
import { enableAuthSchema } from "@application/contracts/validation";
import {
  createSession,
  enableEnforcedAuth,
  getAuthMode,
  getCurrentUser,
  hashPassword,
} from "@application/auth";
import { badRequest, conflict, handle, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First-run: the owner sets a password (and optional email) to switch the
 * household from `open` to `enforced` auth. The owner is logged in immediately
 * so they are not locked out.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") {
    return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }
  if ((await getAuthMode()) === "enforced") {
    return conflict("Authentification déjà activée");
  }

  const parsed = enableAuthSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    await enableEnforcedAuth(
      user.id,
      await hashPassword(parsed.data.password),
      parsed.data.email ?? undefined,
    );
    await createSession(user.id);
    return ok();
  });
}
