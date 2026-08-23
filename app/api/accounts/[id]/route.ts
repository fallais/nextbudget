import { deleteAccount, updateAccount } from "@application/accounts";
import { accountUpdateSchema } from "@application/contracts/validation";
import { badRequest, conflict, handle, notFound, ok, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const accountId = parseId((await context.params).id);
  if (accountId === null) return badRequest("ID invalide");

  const parsed = accountUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const updated = await updateAccount(accountId, parsed.data);
    return updated ? ok() : notFound("Compte introuvable");
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const accountId = parseId((await context.params).id);
  if (accountId === null) return badRequest("ID invalide");

  return handle(async () => {
    const result = await deleteAccount(accountId);
    if (result.ok) return ok();
    if (result.reason === "not_found") return notFound("Compte introuvable");
    return conflict(
      `Ce compte contient ${result.count} transaction${result.count > 1 ? "s" : ""}. ` +
        "Supprimez-les ou déplacez-les avant de supprimer le compte.",
    );
  });
}
