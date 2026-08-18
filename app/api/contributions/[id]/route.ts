import { contributions } from "@infrastructure/persistence/repositories";
import { contributionInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const contributionId = parseId((await context.params).id);
  if (contributionId === null) return badRequest("ID invalide");

  const parsed = patchSchema(contributionInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const updated = await contributions.update(contributionId, parsed.data);
    return updated ? ok() : notFound("Apport introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const contributionId = parseId((await context.params).id);
  if (contributionId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await contributions.delete(contributionId);
    return deleted ? ok() : notFound("Apport introuvable");
  });
}
