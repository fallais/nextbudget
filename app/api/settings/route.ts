import { NextResponse } from "next/server";
import { z } from "zod";
import { getHouseholdMode, setHouseholdMode } from "@application/settings";
import { getAuthMode, getCurrentUser } from "@application/auth";
import { badRequest } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ household: z.enum(["solo", "couple"]) });

export async function GET() {
  const [household, authMode] = await Promise.all([getHouseholdMode(), getAuthMode()]);
  return NextResponse.json({ household, authMode });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") {
    return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return badRequest(parsed.error);
  }
  await setHouseholdMode(parsed.data.household);
  return NextResponse.json({ ok: true });
}
