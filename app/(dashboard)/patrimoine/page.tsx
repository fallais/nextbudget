import { TrendingUp, TrendingDown } from "lucide-react";
import { listAssets, getNetWorth, getNetWorthHistory } from "@/lib/db/assets";
import { listAllAccounts } from "@/lib/db/queries";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { AssetsPane } from "@/components/assets/assets-pane";
import { NetWorthChart } from "@/components/assets/net-worth-chart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PatrimoinePage() {
  const [assets, netWorth, history, accounts] = await Promise.all([
    listAssets(),
    getNetWorth(),
    getNetWorthHistory(),
    listAllAccounts(),
  ]);

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

      <Card>
        <CardContent className="p-5">
          <NetWorthChart data={history} />
        </CardContent>
      </Card>

      <AssetsPane assets={assets} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
}
