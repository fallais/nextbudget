import { getContributionHistory } from "@application/contributions";
import { ApportsView } from "@/components/persons/apports-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOWS = [6, 12, 24];
const DEFAULT_MONTHS = 12;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApportsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.months) ? sp.months[0] : sp.months;
  const parsed = Number.parseInt(raw ?? "", 10);
  const months = WINDOWS.includes(parsed) ? parsed : DEFAULT_MONTHS;

  return <ApportsView perPerson={await getContributionHistory(months)} months={months} />;
}
