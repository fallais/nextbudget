import { addPrepayment } from "@application/assets";
import { NextResponse } from "next/server";
import { prepaymentInputSchema } from "@application/contracts/validation";
import { badRequest, handle, notFound, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const assetId = parseId((await context.params).id);
  if (assetId === null) return badRequest("ID invalide");

  const parsed = prepaymentInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await addPrepayment(assetId, parsed.data);
    if (!created) return notFound("Crédit introuvable");
    return NextResponse.json(created, { status: 201 });
  });
}
