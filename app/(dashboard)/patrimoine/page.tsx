import { effectiveOwners, listAssetOwners, listAssets } from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import type { OwnerShareRow } from "@domain/value-objects/share";
import { PatrimoineView } from "@/components/assets/patrimoine-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PatrimoinePage() {
  const [assets, members, accounts, me] = await Promise.all([
    listAssets(),
    listMembers(),
    listAllAccounts(),
    getCurrentUser(),
  ]);

  const mePerson = me ? await getPersonForUser(me.id) : null;
  const persons = members.map((m) => ({ id: m.person.id, name: m.person.name }));

  const explicit = await listAssetOwners(assets.map((a) => a.id));
  const personByUserId = new Map(
    members.filter((m) => m.user).map((m) => [m.user!.id, m.person]),
  );

  /**
   * Who owns each item, with the implicit case resolved server-side.
   *
   * An asset with no ownership rows belongs wholly to the person behind its
   * `owner_id` — resolving that here means the client can filter by person with
   * a plain multiplication instead of re-deriving the fallback rule.
   */
  const sharesByAsset: Record<number, OwnerShareRow[]> = {};
  for (const a of assets) {
    sharesByAsset[a.id] = effectiveOwners(a, explicit.get(a.id), personByUserId);
  }

  return (
    <PatrimoineView
      assets={assets}
      persons={persons}
      sharesByAsset={sharesByAsset}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      mePersonId={mePerson?.id ?? null}
    />
  );
}
