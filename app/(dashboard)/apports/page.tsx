import { getContributionsByPersonWithStatus } from "@application/contributions";
import { ApportsView } from "@/components/persons/apports-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ApportsPage() {
  return <ApportsView perPerson={await getContributionsByPersonWithStatus()} />;
}
