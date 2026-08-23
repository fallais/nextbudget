import { deletePerson, updatePerson } from "@application/household";
import { personInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, conflict, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const personId = parseId((await context.params).id);
  if (personId === null) return badRequest("ID invalide");

  const parsed = patchSchema(personInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const result = await updatePerson(personId, parsed.data);
    if (result.ok) return ok();
    return result.reason === "user_taken"
      ? conflict("Ce compte utilisateur est déjà lié à une autre personne")
      : notFound("Personne introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const personId = parseId((await context.params).id);
  if (personId === null) return badRequest("ID invalide");

  return handle(async () => {
    const deleted = await deletePerson(personId);
    return deleted ? ok() : notFound("Personne introuvable");
  });
}
