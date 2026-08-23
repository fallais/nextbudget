import { dismissRecurring } from "@application/recurring";
import { recurringDismissalSchema } from "@application/contracts/validation";
import { badRequest, handle, ok } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stop suggesting this repeating charge. */
export async function POST(request: Request) {
  const parsed = recurringDismissalSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    await dismissRecurring(parsed.data.key);
    return ok();
  });
}
