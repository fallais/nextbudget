import { getDataSource } from "@/lib/db/client";
import { TransactionEntity } from "@/lib/db/entities";
import { listAllAccounts } from "@/lib/db/queries";
import { AccountsPane, type AccountRow } from "@/components/accounts/accounts-pane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ComptesPage() {
  const accounts = await listAllAccounts();

  // One grouped count rather than a query per account.
  const ds = await getDataSource();
  const counts = await ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .select("t.account_id", "accountId")
    .addSelect("COUNT(*)", "count")
    .groupBy("t.account_id")
    .getRawMany<{ accountId: number; count: string }>();
  const byAccount = new Map(counts.map((c) => [Number(c.accountId), Number(c.count)]));

  const rows: AccountRow[] = accounts.map((a) => ({
    ...a,
    txCount: byAccount.get(a.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Comptes</h2>
        <p className="text-sm text-muted-foreground">
          Vos comptes bancaires. Chaque personne peut avoir le sien, et le foyer
          un compte commun sur lequel arrivent les apports.
        </p>
      </div>

      <AccountsPane accounts={rows} />
    </div>
  );
}
