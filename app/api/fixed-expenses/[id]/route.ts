import { fixedExpenses } from "@infrastructure/persistence/repositories";
import { fixedExpenseInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const fxId = parseId((await context.params).id);
  if (fxId === null) return badRequest("ID invalide");

  const parsed = patchSchema(fixedExpenseInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const updated = await fixedExpenses.update(fxId, parsed.data);
    return updated ? ok() : notFound("Charge fixe introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const fxId = parseId((await context.params).id);
  if (fxId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await fixedExpenses.delete(fxId);
    return deleted ? ok() : notFound("Charge fixe introuvable");
  });
}
