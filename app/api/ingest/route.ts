import { NextResponse, type NextRequest } from "next/server";
import { ingestUploads, type UploadedFile } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files").filter((e): e is File => e instanceof File);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Aucun fichier reçu" },
        { status: 400 },
      );
    }

    const uploads: UploadedFile[] = await Promise.all(
      entries.map(async (file) => ({
        filename: file.name,
        buffer: Buffer.from(await file.arrayBuffer()),
      })),
    );

    const result = await ingestUploads(uploads);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
