import { NextResponse } from "next/server";
import { users } from "@infrastructure/persistence/repositories";
import { userUpdateSchema } from "@application/contracts/validation";
import { getCurrentUser, hashPassword, publicUser } from "@application/auth";
import { changeUserRole, deleteUser } from "@application/users";
import { badRequest, conflict, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORBIDDEN = NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });

async function isOwner(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && user.role === "owner";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return FORBIDDEN;

  const userId = parseId((await context.params).id);
  if (userId === null) return badRequest("ID invalide");

  const parsed = userUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  const { password, ...rest } = parsed.data;

  return handle(async () => {
    const guard = await changeUserRole(userId, rest);
    if (!guard.ok) {
      return guard.reason === "not_found"
        ? notFound()
        : conflict("Le dernier propriétaire ne peut pas être retiré");
    }

    const updated = await users.update(userId, {
      ...rest,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    });
    return updated ? NextResponse.json(publicUser(updated.toRow())) : notFound();
  }, "Cet email est déjà utilisé par un autre compte");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return FORBIDDEN;

  const userId = parseId((await context.params).id);
  if (userId === null) return badRequest("ID invalide");

  return handle(async () => {
    const result = await deleteUser(userId);
    if (result.ok) return ok();
    return result.reason === "not_found"
      ? notFound()
      : conflict("Le dernier propriétaire ne peut pas être supprimé");
  });
}
