import { listCredits, summarizeCredits } from "@application/credits";
import { listAssets } from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import { CreditsView } from "@/components/credits/credits-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const [credits, assets, accounts, members, me] = await Promise.all([
    listCredits(),
    listAssets(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);
  const mePerson = me ? await getPersonForUser(me.id) : null;

  return (
    <CreditsView
      credits={credits}
      totals={summarizeCredits(credits)}
      persons={members.map((m) => ({ id: m.person.id, name: m.person.name }))}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      linkableAssets={assets.filter((a) => a.kind === "asset").map((a) => ({ id: a.id, name: a.name }))}
      mePersonId={mePerson?.id ?? null}
    />
  );
}
