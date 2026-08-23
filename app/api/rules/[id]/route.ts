import { deleteRule, updateRule } from "@application/rules";
import { ruleInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ruleId = parseId((await context.params).id);
  if (ruleId === null) return badRequest("ID invalide");

  const parsed = patchSchema(ruleInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await updateRule(ruleId, parsed.data);
    return updated ? ok() : notFound("Règle introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ruleId = parseId((await context.params).id);
  if (ruleId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await deleteRule(ruleId);
    return deleted ? ok() : notFound("Règle introuvable");
  });
}
