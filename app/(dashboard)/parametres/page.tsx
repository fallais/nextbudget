import { transactions } from "@infrastructure/persistence/repositories";
import { listMembers } from "@application/household";
import { listAllAccounts } from "@application/queries";
import { getHouseholdMode } from "@application/settings";
import { getAuthMode, getCurrentUser } from "@application/auth";
import { SettingsPane, type SettingsMember } from "@/components/settings/settings-pane";
import type { AccountListItem } from "@/components/accounts/accounts-pane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const [household, authMode, members, accounts, txCounts, me] = await Promise.all([
    getHouseholdMode(),
    getAuthMode(),
    listMembers(),
    listAllAccounts(),
    // One grouped count rather than a query per account.
    transactions.countByAccountGrouped(),
    getCurrentUser(),
  ]);

  const rows: SettingsMember[] = members.map((m) => ({
    id: m.person.id,
    name: m.person.name,
    userId: m.user?.id ?? null,
    email: m.user?.email ?? null,
  }));
  const mine = me ? (rows.find((r) => r.userId === me.id) ?? null) : null;

  const accountRows: AccountListItem[] = accounts.map((a) => ({
    ...a,
    txCount: txCounts.get(a.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
        <p className="text-sm text-muted-foreground">
          Composition du foyer, comptes bancaires et confidentialité.
        </p>
      </div>

      <SettingsPane
        household={household}
        authMode={authMode}
        members={rows}
        accounts={accountRows}
        isOwner={me?.role === "owner"}
        me={mine}
      />
    </div>
  );
}
