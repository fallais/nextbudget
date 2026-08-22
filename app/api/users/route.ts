import { NextResponse } from "next/server";
import { users } from "@infrastructure/persistence/repositories";
import { userInputSchema } from "@application/contracts/validation";
import { getCurrentUser, hashPassword, publicUser } from "@application/auth";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORBIDDEN = NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });

async function isOwner(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && user.role === "owner";
}

export async function GET() {
  if (!(await isOwner())) return FORBIDDEN;

  const all = await users.findAll();
  return NextResponse.json(all.map((u) => publicUser(u.toRow())));
}

export async function POST(request: Request) {
  if (!(await isOwner())) return FORBIDDEN;

  const parsed = userInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await users.create({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
      passwordHash: parsed.data.password ? await hashPassword(parsed.data.password) : null,
    });
    return NextResponse.json(publicUser(created.toRow()), { status: 201 });
  }, "Cet email est déjà utilisé par un autre compte");
}
