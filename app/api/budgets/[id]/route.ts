import { budgets } from "@infrastructure/persistence/repositories";
import { budgetUpdateSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const budgetId = parseId((await context.params).id);
  if (budgetId === null) return badRequest("ID invalide");

  const parsed = budgetUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await budgets.update(budgetId, parsed.data);
    return updated ? ok() : notFound("Budget introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const budgetId = parseId((await context.params).id);
  if (budgetId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await budgets.delete(budgetId);
    return deleted ? ok() : notFound("Budget introuvable");
  });
}
