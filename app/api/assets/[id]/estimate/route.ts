import { NextResponse } from "next/server";
import { estimateAsset } from "@application/estimation";
import { badRequest, handle, notFound, parseId } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISSING_LABELS = {
  address: "l'adresse",
  surfaceM2: "la surface",
  propertyKind: "le type de bien",
} as const;

/**
 * POST, not GET: this reaches out to the geocoder and the open-data host, so
 * it happens when someone asks for it and never because a page rendered.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const assetId = parseId((await context.params).id);
  if (assetId === null) return badRequest("ID invalide");

  return handle(async () => {
    const outcome = await estimateAsset(assetId);
    switch (outcome.status) {
      case "not_found":
        return notFound("Bien introuvable");
      case "incomplete":
        return badRequest(
          `Renseignez ${outcome.missing.map((m) => MISSING_LABELS[m]).join(", ")} pour estimer ce bien.`,
        );
      case "not_geocoded":
        return badRequest("Adresse introuvable. Vérifiez-la — numéro, rue, code postal, commune.");
      // "Not enough sales nearby" is an answer, not a failure: the address was
      // fine and the register simply has too little to say.
      default:
        return NextResponse.json(outcome);
    }
  });
}
