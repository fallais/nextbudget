import { listAssets } from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import { NewAssetForm } from "@/components/assets/new-asset-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const [assets, accounts, members, me] = await Promise.all([
    listAssets(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);
  const mePerson = me ? await getPersonForUser(me.id) : null;

  return (
    <NewAssetForm
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      persons={members.map((m) => ({ id: m.person.id, name: m.person.name }))}
      mePersonId={mePerson?.id ?? null}
      linkableAssets={assets
        .filter((a) => a.kind === "asset")
        .map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
