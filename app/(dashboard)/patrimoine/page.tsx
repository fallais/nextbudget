import { TrendingUp, TrendingDown } from "lucide-react";
import {
  listAssets,
  listAssetOwners,
  getNetWorth,
  getNetWorthByPerson,
  getNetWorthHistory,
} from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { listMembers, getPersonForUser } from "@application/household";
import { getCurrentUser } from "@application/auth";
import type { OwnerShareRow } from "@domain/value-objects/share";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@shared/utils";
import { formatCents } from "@shared/format";
import { AssetsPane } from "@/components/assets/assets-pane";
import { NetWorthChart } from "@/components/assets/net-worth-chart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PatrimoinePage() {
  const [assets, netWorth, history, accounts, members, me] = await Promise.all([
    listAssets(),
    getNetWorth(),
    getNetWorthHistory(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);

  const persons = members.map((m) => ({ id: m.person.id, name: m.person.name }));
  const mePerson = me ? await getPersonForUser(me.id) : null;

  // Per-person split only means something with more than one member.
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
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Patrimoine</h2>
        <p className="text-sm text-muted-foreground">
          Vos actifs et passifs, et votre valeur nette (actifs − passifs).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Valeur nette</p>
            <p
              className={cn(
                "text-3xl font-semibold tabular-nums",
                netWorth.netCents >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {formatCents(netWorth.netCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="size-4" /> Actifs
            </p>
            <p className="text-2xl font-semibold tabular-nums">{formatCents(netWorth.assetsCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingDown className="size-4" /> Passifs
            </p>
            <p className="text-2xl font-semibold tabular-nums">{formatCents(netWorth.liabilitiesCents)}</p>
          </CardContent>
        </Card>
      </div>

      {breakdown && breakdown.byPerson.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Par personne</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.byPerson.map((p) => (
              <Card key={p.personId}>
                <CardContent className="space-y-1 p-5">
                  <p className="text-sm font-medium">{p.personName}</p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      p.netCents >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {formatCents(p.netCents)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCents(p.assetsCents)} d&apos;actifs ·{" "}
                    {formatCents(p.liabilitiesCents)} de passifs
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {breakdown.unattributedNetCents !== 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCents(breakdown.unattributedNetCents)} ne sont rattachés à
              personne. Modifiez ces éléments pour indiquer qui les possède.
            </p>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <NetWorthChart data={history} />
        </CardContent>
      </Card>

      <AssetsPane
        assets={assets}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        persons={persons}
        ownersByAsset={ownersByAsset}
        mePersonId={mePerson?.id ?? null}
      />
    </div>
  );
}
