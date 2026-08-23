import { NextResponse } from "next/server";
import { linkTransfer } from "@application/transfers";
import { transferInputSchema } from "@application/contracts/validation";
import { badRequest, conflict, handle, notFound } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Declare a set of lines to be one move between your own accounts. */
export async function POST(request: Request) {
  const parsed = transferInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const result = await linkTransfer(parsed.data.transactionIds);
    if (result.ok) return NextResponse.json(result, { status: 201 });
    switch (result.reason) {
      case "not_found":
        return notFound("Transaction introuvable");
      case "already_linked":
        return conflict("Cette opération fait déjà partie d'un virement.");
      case "same_account":
        return badRequest("Un virement relie deux comptes différents.");
      case "no_legs":
        return badRequest("Sélectionnez au moins une opération.");
    }
  });
}
