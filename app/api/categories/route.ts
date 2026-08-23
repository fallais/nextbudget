import { NextResponse } from "next/server";
import { createCategory, listCategories } from "@application/categories";
import { categoryInputSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listCategories());
}

export async function POST(request: Request) {
  const parsed = categoryInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await createCategory(parsed.data);
    return NextResponse.json(created, { status: 201 });
  }, "Une catégorie avec ce nom existe déjà");
}
