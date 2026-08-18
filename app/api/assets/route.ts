import { NextResponse } from "next/server";
import { assets } from "@infrastructure/persistence/repositories";
import { assetInputSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { listAssets } from "@application/assets";
import { Ownership } from "@domain/value-objects/share";
import type { NewAsset } from "@domain/entities";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAssets());
}

export async function POST(request: Request) {
  const parsed = assetInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  const { owners, ...assetData } = parsed.data;

  return handle(async () => {
    // Ownership validates itself: a set that does not total 100% cannot be
    // constructed, so an invalid split never reaches the database. A
    // DomainError from here is mapped to a 400 by `handle`.
    if (owners) Ownership.fromRows(owners);

    const ownerId = (await getCurrentUser())?.id ?? null;
    const created = await assets.createWithOwners(
      { ...assetData, ownerId, visibility: "shared" } as NewAsset,
      owners,
    );
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
