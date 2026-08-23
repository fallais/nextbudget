import { NextResponse } from "next/server";
import { createContribution } from "@application/contributions";
import { listContributions } from "@application/contributions";
import { contributionInputSchema } from "@application/contracts/validation";
import { badRequest, handle } from "@/app/api/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listContributions());
}

export async function POST(request: Request) {
  const parsed = contributionInputSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  return handle(async () => {
    const created = await createContribution(parsed.data);
    return NextResponse.json(created, { status: 201 });
  });
}
