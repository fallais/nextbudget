import { deleteFixedExpense, updateFixedExpense } from "@application/fixed-expenses";
import { fixedExpenseInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const fxId = parseId((await context.params).id);
  if (fxId === null) return badRequest("ID invalide");

  const parsed = patchSchema(fixedExpenseInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await updateFixedExpense(fxId, parsed.data);
    return updated ? ok() : notFound("Charge fixe introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const fxId = parseId((await context.params).id);
  if (fxId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await deleteFixedExpense(fxId);
    return deleted ? ok() : notFound("Charge fixe introuvable");
  });
}
