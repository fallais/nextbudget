import { NextResponse } from "next/server";
import { categories } from "@infrastructure/persistence/repositories";
import { categoryInputSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const all = await categories.findAll();
  return NextResponse.json(all.map((c) => c.toRow()));
}

export async function POST(request: Request) {
  const parsed = categoryInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.message);

  return handle(async () => {
    const created = await categories.create({ ...parsed.data, isDefault: false });
    return NextResponse.json(created.toRow(), { status: 201 });
  }, "Une catégorie avec ce nom existe déjà");
}
