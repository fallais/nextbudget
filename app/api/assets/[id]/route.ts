import { deleteAsset, updateAsset } from "@application/assets";
import { assetUpdateSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const assetId = parseId((await context.params).id);
  if (assetId === null) return badRequest("ID invalide");

  const parsed = assetUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await updateAsset(assetId, parsed.data);
    return updated ? ok() : notFound("Actif introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const assetId = parseId((await context.params).id);
  if (assetId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await deleteAsset(assetId);
    return deleted ? ok() : notFound("Actif introuvable");
  });
}
