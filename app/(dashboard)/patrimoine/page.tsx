import {
  getNetWorth,
  getNetWorthByPerson,
  getNetWorthHistory,
  listAssetOwners,
  listAssets,
} from "@application/assets";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import { listAllAccounts } from "@application/queries";
import type { OwnerShareRow } from "@domain/value-objects/share";
import { PatrimoineView } from "@/components/assets/patrimoine-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PatrimoinePage() {
  const [assets, netWorth, history, members, accounts, me] = await Promise.all([
    listAssets(),
    getNetWorth(),
    getNetWorthHistory(),
    listMembers(),
    listAllAccounts(),
    getCurrentUser(),
  ]);
  const mePerson = me ? await getPersonForUser(me.id) : null;

  const persons = members.map((m) => ({ id: m.person.id, name: m.person.name }));
  // A per-person split only means something with more than one member.
  const breakdown = persons.length > 1 ? await getNetWorthByPerson() : null;

  const ownerRows = await listAssetOwners(assets.map((a) => a.id));
  const ownersByAsset: Record<number, OwnerShareRow[]> = {};
  for (const [assetId, rows] of ownerRows) {
    ownersByAsset[assetId] = rows.map((r) => ({
      personId: r.personId,
      shareBps: r.shareBps,
    }));
  }

  return (
    <PatrimoineView
      assets={assets}
      netWorth={netWorth}
      history={history}
      breakdown={breakdown}
      ownersByAsset={ownersByAsset}
      persons={persons}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      mePersonId={mePerson?.id ?? null}
    />
  );
}
