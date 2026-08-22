import { assets } from "@infrastructure/persistence/repositories";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; prepaymentId: string }> },
) {
  const { id, prepaymentId } = await context.params;
  const assetId = parseId(id);
  const paymentId = parseId(prepaymentId);
  if (assetId === null || paymentId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await assets.deletePrepayment(assetId, paymentId);
    return deleted ? ok() : notFound("Remboursement introuvable");
  });
}
