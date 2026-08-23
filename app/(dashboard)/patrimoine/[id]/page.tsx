import { notFound } from "next/navigation";
import { effectiveOwners, listAssetOwners, listAssets } from "@application/assets";
import { listEstimations } from "@application/estimation";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import type { AssetOwnerInput } from "@domain/repositories";
import { AssetDetail } from "@/components/assets/asset-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assetId = Number.parseInt(id, 10);
  if (!Number.isInteger(assetId)) notFound();

  const [assets, accounts, members, me] = await Promise.all([
    listAssets(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);

  const asset = assets.find((a) => a.id === assetId);
  if (!asset) notFound();

  const mePerson = me ? await getPersonForUser(me.id) : null;
  // Read, never computed: rendering this page must not reach for the geocoder.
  const estimations = await listEstimations(assetId);
  const explicit = await listAssetOwners([assetId]);
  const personByUserId = new Map(members.filter((m) => m.user).map((m) => [m.user!.id, m.person]));

  const owners: AssetOwnerInput[] = (explicit.get(assetId) ?? []).map((r) => ({
    personId: r.personId,
    shareBps: r.shareBps,
    insuranceMonthlyCents: r.insuranceMonthlyCents,
  }));

  return (
    <AssetDetail
      asset={asset}
      shares={effectiveOwners(asset, explicit.get(assetId), personByUserId)}
      owners={owners}
      persons={members.map((m) => ({ id: m.person.id, name: m.person.name }))}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      linkableAssets={assets
        .filter((a) => a.kind === "asset" && a.id !== assetId)
        .map((a) => ({ id: a.id, name: a.name }))}
      // A loan pointing at this asset, and the asset this loan points at —
      // the same link read from either end.
      linkedCredit={
        assets
          .filter((a) => a.kind === "liability" && a.linkedAssetId === assetId)
          .map((a) => ({ id: a.id, name: a.name, valueCents: a.valueCents }))[0] ?? null
      }
      financedAsset={
        assets
          .filter((a) => a.id === asset.linkedAssetId)
          .map((a) => ({ id: a.id, name: a.name, valueCents: a.valueCents }))[0] ?? null
      }
      estimations={estimations}
      mePersonId={mePerson?.id ?? null}
    />
  );
}
