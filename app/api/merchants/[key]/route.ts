import { z } from "zod";
import { setMerchantOverride } from "@application/categorize/merchants";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Not disabled means "back to the catalogue default". */
const overrideSchema = z.object({
  disabled: z.boolean().default(false),
});

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const parsed = overrideSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    await setMerchantOverride(
      key,
      { disabled: parsed.data.disabled },
      (await getCurrentUser())?.id ?? null,
    );
    return ok();
  });
}
