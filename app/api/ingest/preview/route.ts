import { NextResponse, type NextRequest } from "next/server";
import { previewUploads, type UploadedFile } from "@application/ingest";
import { mappingsByFileSchema } from "@application/contracts/validation";
import { badRequest } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read the uploads and say what was recognised — no writes.
 *
 * The same files are posted again to `/api/ingest` once the mapping is
 * confirmed. Re-uploading rather than parking the parse in a server-side
 * session keeps this endpoint stateless, and statements are small.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files").filter((e): e is File => e instanceof File);
    if (entries.length === 0) return badRequest("Aucun fichier reçu");

    const rawMappings = formData.get("mappings");
    const parsedMappings =
      typeof rawMappings === "string" && rawMappings.trim() !== ""
        ? mappingsByFileSchema.safeParse(JSON.parse(rawMappings))
        : null;
    if (parsedMappings && !parsedMappings.success) {
      return badRequest(parsedMappings.error);
    }

    const uploads: UploadedFile[] = await Promise.all(
      entries.map(async (file) => ({
        filename: file.name,
        buffer: Buffer.from(await file.arrayBuffer()),
      })),
    );

    return NextResponse.json({ files: await previewUploads(uploads, parsedMappings?.data ?? {}) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
