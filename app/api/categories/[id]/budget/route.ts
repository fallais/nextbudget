import { setCategoryBudget } from "@application/categories";
import { categoryBudgetSchema } from "@application/contracts/validation";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const catId = parseId((await context.params).id);
  if (catId === null) return badRequest("ID invalide");

  const parsed = categoryBudgetSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    await setCategoryBudget(
      catId,
      parsed.data.budgetAmountCents,
      parsed.data.budgetPeriod,
      (await getCurrentUser())?.id ?? null,
    );
    return ok();
  });
}
