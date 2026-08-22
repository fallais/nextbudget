import { z } from "zod";
import { setVisibility } from "@application/visibility";
import { badRequest, handle, notFound, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["account", "asset", "budget", "contribution", "fixedExpense", "rule"]),
  id: z.number().int().positive(),
  visibility: z.enum(["private", "shared"]),
});

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  const { kind, id, visibility } = parsed.data;
  return handle(async () => {
    const updated = await setVisibility(kind, id, visibility);
    return updated ? ok() : notFound();
  });
}
