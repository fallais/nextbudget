import { NextResponse } from "next/server";
import { assetInputSchema } from "@application/contracts/validation";
import { createAsset, listAssets } from "@application/assets";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAssets());
}

export async function POST(request: Request) {
  const parsed = assetInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await createAsset(parsed.data);
    return NextResponse.json(created, { status: 201 });
  });
}
