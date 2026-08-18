import { persons } from "@infrastructure/persistence/repositories";
import { deletePerson, isUserLinkTaken } from "@application/household";
import { personInputSchema, patchSchema } from "@application/contracts/validation";
import { badRequest, conflict, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const personId = parseId((await context.params).id);
  if (personId === null) return badRequest("ID invalide");

  const parsed = patchSchema(personInputSchema).safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  if (parsed.data.userId != null && (await isUserLinkTaken(parsed.data.userId, personId))) {
    return conflict("Ce compte utilisateur est déjà lié à une autre personne");
  }

  return handle(async () => {
    const updated = await persons.update(personId, parsed.data);
    return updated ? ok() : notFound("Personne introuvable");
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
