import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { UserEntity } from "@/lib/db/entities";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, createSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { identifier, password } = parsed.data;

  const ds = await getDataSource();
  const user = await ds
    .getRepository(UserEntity)
    .createQueryBuilder("u")
    .where("(u.email = :id OR u.name = :id)", { id: identifier })
    .andWhere("u.is_active = true")
    .getOne();

  if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
