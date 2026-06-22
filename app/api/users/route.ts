import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { UserEntity } from "@/lib/db/entities";
import { userInputSchema } from "@/lib/validation";
import { getCurrentUser, hashPassword, publicUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isOwner(): Promise<boolean> {
  const u = await getCurrentUser();
  return !!u && u.role === "owner";
}

export async function GET() {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }
  const ds = await getDataSource();
  const users = await ds.getRepository(UserEntity).find({ order: { id: "ASC" } });
  return NextResponse.json(users.map(publicUser));
}

export async function POST(request: Request) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }
  const parsed = userInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const ds = await getDataSource();
  const repo = ds.getRepository(UserEntity);
  const created = await repo.save(
    repo.create({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
      passwordHash: parsed.data.password ? await hashPassword(parsed.data.password) : null,
    }),
  );
  return NextResponse.json(publicUser(created), { status: 201 });
}
