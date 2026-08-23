import { getFixedExpenseTrends, summarizeTrends } from "@application/fixed-expenses";
import { TrendsView } from "@/components/fixed-expenses/trends-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FixedExpenseTrendsPage() {
  const trends = await getFixedExpenseTrends();
  return <TrendsView trends={trends} summary={summarizeTrends(trends)} />;
}
