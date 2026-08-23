import { countTransactionsByAccount } from "@application/transactions";
import { listMembers } from "@application/household";
import { listAllAccounts } from "@application/queries";
import { getHouseholdMode } from "@application/settings";
import { getAuthMode, getCurrentUser } from "@application/auth";
import {
  SettingsView,
  type SettingsAccount,
  type SettingsMember,
} from "@/components/settings/settings-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const [household, authMode, members, accounts, txCounts, me] = await Promise.all([
    getHouseholdMode(),
    getAuthMode(),
    listMembers(),
    listAllAccounts(),
    // One grouped count rather than a query per account.
    countTransactionsByAccount(),
    getCurrentUser(),
  ]);

  const rows: SettingsMember[] = members.map((m) => ({
    id: m.person.id,
    name: m.person.name,
    userId: m.user?.id ?? null,
    email: m.user?.email ?? null,
    matchPattern: m.person.matchPattern,
  }));

  const accountRows: SettingsAccount[] = accounts.map((a) => ({
    ...a,
    txCount: txCounts.get(a.id) ?? 0,
  }));

  return (
    <SettingsView
      household={household}
      authMode={authMode}
      members={rows}
      accounts={accountRows}
      isOwner={me?.role === "owner"}
    />
  );
}
