import { CalendarClock, Coins, TrendingDown } from "lucide-react";
import { listCredits, listLinkableAssets, summarizeCredits } from "@application/credits";
import { listAssetOwners } from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import type { AssetOwnerInput } from "@domain/repositories";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@shared/format";
import { CreditsPane } from "@/components/credits/credits-pane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const [credits, linkableAssets, accounts, members, me] = await Promise.all([
    listCredits(),
    listLinkableAssets(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);

  const totals = summarizeCredits(credits);
  const persons = members.map((m) => ({ id: m.person.id, name: m.person.name }));
  const mePerson = me ? await getPersonForUser(me.id) : null;

  // The edit dialog needs the current split: an empty set means "wholly mine"
  // to the form, so saving without it would silently reassign a shared loan.
  const ownerRows = await listAssetOwners(credits.map((c) => c.credit.id));
  const ownersByAsset: Record<number, AssetOwnerInput[]> = {};
  for (const [assetId, rows] of ownerRows) {
    ownersByAsset[assetId] = rows.map((r) => ({
      personId: r.personId,
      shareBps: r.shareBps,
      insuranceMonthlyCents: r.insuranceMonthlyCents,
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Crédits</h2>
        <p className="text-sm text-muted-foreground">
          Vos emprunts : ce qu&apos;il reste à rembourser, ce qu&apos;ils coûtent
          vraiment, et le bien que chacun finance.
        </p>
      </div>

      {totals.count > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-1 p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingDown className="size-4" /> Capital restant dû
              </p>
              <p className="text-3xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCents(totals.outstandingCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totals.count} crédit{totals.count > 1 ? "s" : ""} en cours
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarClock className="size-4" /> Mensualités
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCents(totals.monthlyPaymentCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totals.monthlyTotalCents > totals.monthlyPaymentCents
                  ? `+ ${formatCents(totals.monthlyTotalCents - totals.monthlyPaymentCents)} d'assurance = ${formatCents(totals.monthlyTotalCents)}`
                  : "hors assurance"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Coins className="size-4" /> Coût total du crédit
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCents(totals.totalCostCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                intérêts, assurance et frais sur toute la durée
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <CreditsPane
        credits={credits}
        linkableAssets={linkableAssets}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        persons={persons}
        ownersByAsset={ownersByAsset}
        mePersonId={mePerson?.id ?? null}
      />
    </div>
  );
}
