import { z } from "zod";
import { clearMerchantOverride, setMerchantOverride } from "@application/categorize/merchants";
import { getCurrentUser } from "@application/auth";
import { badRequest, handle, notFound, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `null` category + not disabled means "back to the catalogue default". */
const overrideSchema = z.object({
  categoryId: z.number().int().positive().nullable(),
  disabled: z.boolean().default(false),
});

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const parsed = overrideSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    await setMerchantOverride(
      key,
      { categoryId: parsed.data.categoryId, disabled: parsed.data.disabled },
      (await getCurrentUser())?.id ?? null,
    );
    return ok();
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  return handle(async () => {
    const cleared = await clearMerchantOverride(key);
    return cleared ? ok() : notFound("Aucun réglage pour ce marchand");
  });
}
