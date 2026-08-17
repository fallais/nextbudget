import { NextResponse } from "next/server";
import { getDataSource } from "@infrastructure/db/client";
import { UserEntity, SettingEntity } from "@infrastructure/db/schemas";
import { enableAuthSchema } from "@application/contracts/validation";
import { getCurrentUser, getAuthMode, hashPassword, createSession } from "@application/auth";

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
    return NextResponse.json({ error: "Authentification déjà activée" }, { status: 409 });
  }

  const body = await request.json();
  const parsed = enableAuthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const ds = await getDataSource();
  await ds.getRepository(UserEntity).update(user.id, {
    passwordHash: await hashPassword(parsed.data.password),
    ...(parsed.data.email ? { email: parsed.data.email } : {}),
  });
  // settings.key is the PK → save upserts.
  await ds.getRepository(SettingEntity).save({ key: "authMode", value: "enforced" });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
