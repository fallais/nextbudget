import { listCredits, summarizeCredits } from "@application/credits";
import { CreditsView } from "@/components/credits/credits-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const credits = await listCredits();

  return <CreditsView credits={credits} totals={summarizeCredits(credits)} />;
}
