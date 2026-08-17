import { NextResponse } from "next/server";
import { IsNull } from "typeorm";
import { getDataSource } from "@infrastructure/db/client";
import { isUniqueViolation } from "@infrastructure/db/errors";
import { UserEntity, SessionEntity, PersonEntity, AccountEntity, RuleEntity, ContributionEntity, FixedExpenseEntity, BudgetEntity, AssetEntity } from "@infrastructure/db/schemas";
import { userUpdateSchema } from "@application/contracts/validation";
import { getCurrentUser, hashPassword, publicUser } from "@application/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerOr403() {
  const u = await getCurrentUser();
  return u && u.role === "owner" ? u : null;
}

async function ownerCount(ds: Awaited<ReturnType<typeof getDataSource>>): Promise<number> {
  return ds.getRepository(UserEntity).count({ where: { role: "owner", isActive: true } });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const acting = await ownerOr403();
  if (!acting) return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });

  const userId = Number.parseInt((await context.params).id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }
  const parsed = userUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(UserEntity);
  const target = await repo.findOne({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Don't let the last active owner be demoted or deactivated.
  const demotes =
    (parsed.data.role && parsed.data.role !== "owner") || parsed.data.isActive === false;
  if (target.role === "owner" && demotes && (await ownerCount(ds)) <= 1) {
    return NextResponse.json({ error: "Le dernier propriétaire ne peut pas être retiré" }, { status: 409 });
  }

  const { password, ...rest } = parsed.data;
  try {
    await repo.update(userId, {
      ...rest,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    });
  } catch (err) {
    // users.email is unique; say so rather than surfacing a bare 500.
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé par un autre compte" },
        { status: 409 },
      );
    }
    throw err;
  }
  const updated = await repo.findOne({ where: { id: userId } });
  return NextResponse.json(updated ? publicUser(updated) : { ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const acting = await ownerOr403();
  if (!acting) return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });

  const userId = Number.parseInt((await context.params).id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const ds = await getDataSource();
  const target = await ds.getRepository(UserEntity).findOne({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (target.role === "owner" && (await ownerCount(ds)) <= 1) {
    return NextResponse.json({ error: "Le dernier propriétaire ne peut pas être supprimé" }, { status: 409 });
  }

  // Reproduce the old FK behaviour: sessions cascade; ownership refs set null.
  await ds.getRepository(SessionEntity).delete({ userId });
  await ds.getRepository(PersonEntity).update({ userId }, { userId: null });
  await ds.getRepository(AccountEntity).update({ ownerId: userId }, { ownerId: null });
  await ds.getRepository(RuleEntity).update({ ownerId: userId }, { ownerId: null });
  await ds.getRepository(ContributionEntity).update({ ownerId: userId }, { ownerId: null });
  await ds.getRepository(FixedExpenseEntity).update({ ownerId: userId }, { ownerId: null });
  await ds.getRepository(BudgetEntity).update({ ownerId: userId }, { ownerId: null });
  await ds.getRepository(AssetEntity).update({ ownerId: userId }, { ownerId: null });
  await ds.getRepository(UserEntity).delete(userId);
  return NextResponse.json({ ok: true });
}
