import { transactions } from "@infrastructure/persistence/repositories";
import { updateTransactionSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const txId = parseId((await context.params).id);
  if (txId === null) return badRequest("ID invalide");

  const parsed = updateTransactionSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await transactions.update(txId, { categoryId: parsed.data.categoryId });
    return updated ? ok() : notFound("Transaction introuvable");
  });
}
