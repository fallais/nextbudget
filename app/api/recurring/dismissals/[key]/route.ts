import { restoreRecurring } from "@application/recurring";
import { handle, notFound, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Offer it again. The key travels URL-encoded: it holds spaces and dots. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  return handle(async () =>
    (await restoreRecurring(decodeURIComponent(key))) ? ok() : notFound("Suggestion introuvable"),
  );
}
