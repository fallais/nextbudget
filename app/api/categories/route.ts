import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/client";
import { CategoryEntity } from "@/lib/db/entities";
import { categoryInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataSource();
  const rows = await ds.getRepository(CategoryEntity).find({ order: { name: "ASC" } });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = categoryInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(CategoryEntity);
    const created = await repo.save(repo.create({ ...parsed.data, isDefault: false }));
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const message = e.message ?? String(err);
    if (e.code === "23505" || message.toLowerCase().includes("unique")) {
      return NextResponse.json(
        { error: "Une catégorie avec ce nom existe déjà" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
