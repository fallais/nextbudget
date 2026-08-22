import { categories } from "@infrastructure/persistence/repositories";
import { deleteCategory } from "@application/categories";
import { categoryInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const catId = parseId((await context.params).id);
  if (catId === null) return badRequest("ID invalide");

  const parsed = patchSchema(categoryInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await categories.update(catId, parsed.data);
    return updated ? ok() : notFound("Catégorie introuvable");
  }, "Une catégorie avec ce nom existe déjà");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const catId = parseId((await context.params).id);
  if (catId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await deleteCategory(catId);
    return deleted ? ok() : notFound("Catégorie introuvable");
  });
}
