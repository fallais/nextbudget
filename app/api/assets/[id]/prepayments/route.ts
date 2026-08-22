import { NextResponse } from "next/server";
import { assets } from "@infrastructure/persistence/repositories";
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
    const asset = await assets.findById(assetId);
    if (!asset) return notFound("Crédit introuvable");

    const created = await assets.addPrepayment({
      assetId,
      date: parsed.data.date,
      amountCents: parsed.data.amountCents,
      mode: parsed.data.mode,
      feesCents: parsed.data.feesCents ?? null,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(created.toRow(), { status: 201 });
  });
}
