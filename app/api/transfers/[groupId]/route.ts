import { unlinkTransfer } from "@application/transfers";
import { handle, notFound, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Put both legs back where the pairing found them. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await context.params;
  return handle(async () =>
    (await unlinkTransfer(groupId)) ? ok() : notFound("Virement introuvable"),
  );
}
