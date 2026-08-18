import { assets } from "@infrastructure/persistence/repositories";
import { assetUpdateSchema } from "@application/contracts/validation";
import { Ownership } from "@domain/value-objects/share";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const assetId = parseId((await context.params).id);
  if (assetId === null) return badRequest("ID invalide");

  const parsed = assetUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  const { owners, ...assetData } = parsed.data;

  return handle(async () => {
    // Ownership validates itself: a set that does not total 100% cannot be
    // constructed, so an invalid split never reaches the database.
    if (owners) Ownership.fromRows(owners);

    const updated = await assets.updateWithOwners(assetId, assetData, owners);
    return updated ? ok() : notFound("Actif introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const assetId = parseId((await context.params).id);
  if (assetId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await assets.deleteWithDependents(assetId);
    return deleted ? ok() : notFound("Actif introuvable");
  });
}
