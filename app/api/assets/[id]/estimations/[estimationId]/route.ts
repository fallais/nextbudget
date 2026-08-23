import { deleteEstimation } from "@application/estimation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; estimationId: string }> },
) {
  const { id, estimationId } = await context.params;
  const assetId = parseId(id);
  const rowId = parseId(estimationId);
  if (assetId === null || rowId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await deleteEstimation(assetId, rowId);
    return deleted ? ok() : notFound("Estimation introuvable");
  });
}
