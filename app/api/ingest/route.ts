import { NextResponse, type NextRequest } from "next/server";
import { ingestUploads, type UploadedFile } from "@application/ingest";
import { mappingsByFileSchema } from "@application/contracts/validation";
import { badRequest } from "@/app/api/_lib/respond";

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

    const rawAccountId = formData.get("accountId");
    let accountId: number | null = null;
    if (typeof rawAccountId === "string" && rawAccountId.trim() !== "") {
      const parsed = Number.parseInt(rawAccountId, 10);
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: "Compte invalide" }, { status: 400 });
      }
      accountId = parsed;
    }

    // Sent by the confirm step; absent when a caller trusts detection.
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

    const result = await ingestUploads(uploads, accountId, parsedMappings?.data ?? {});
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
