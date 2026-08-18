import { notFound } from "next/navigation";
import { listCredits } from "@application/credits";
import { listAssetOwners, listAssets } from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import type { AssetOwnerInput } from "@domain/repositories";
import { CreditDetail } from "@/components/credits/credit-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One credit, in full: the schedule and the cost breakdown live here rather
 * than folded into the list, so the list stays scannable and the detail has
 * room to be read.
 */
export default async function CreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creditId = Number.parseInt(id, 10);
  if (!Number.isInteger(creditId)) notFound();

  const [credits, assets, accounts, members, me] = await Promise.all([
    listCredits(),
    listAssets(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);

  const item = credits.find((c) => c.credit.id === creditId);
  if (!item) notFound();

  const mePerson = me ? await getPersonForUser(me.id) : null;
  const ownerRows = await listAssetOwners([creditId]);
  const owners: AssetOwnerInput[] = (ownerRows.get(creditId) ?? []).map((r) => ({
    personId: r.personId,
    shareBps: r.shareBps,
    insuranceMonthlyCents: r.insuranceMonthlyCents,
  }));

  return (
    <CreditDetail
      item={item}
      owners={owners}
      mePersonId={mePerson?.id ?? null}
      persons={members.map((m) => ({ id: m.person.id, name: m.person.name }))}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      linkableAssets={assets
        .filter((a) => a.kind === "asset")
        .map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
