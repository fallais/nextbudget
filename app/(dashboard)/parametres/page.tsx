import { listMembers } from "@application/household";
import { listAllAccounts } from "@application/queries";
import { getHouseholdMode } from "@application/settings";
import { getAuthMode, getCurrentUser } from "@application/auth";
import { SettingsPane, type SettingsMember } from "@/components/settings/settings-pane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const [household, authMode, members, accounts, me] = await Promise.all([
    getHouseholdMode(),
    getAuthMode(),
    listMembers(),
    listAllAccounts(),
    getCurrentUser(),
  ]);

  const rows: SettingsMember[] = members.map((m) => ({
    id: m.person.id,
    name: m.person.name,
    userId: m.user?.id ?? null,
    email: m.user?.email ?? null,
  }));
  const mine = me ? (rows.find((r) => r.userId === me.id) ?? null) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
        <p className="text-sm text-muted-foreground">
          Composition du foyer, confidentialité et comptes.
        </p>
      </div>

      <SettingsPane
        household={household}
        authMode={authMode}
        members={rows}
        accountCount={accounts.length}
        jointAccountCount={accounts.filter((a) => a.kind === "joint").length}
        isOwner={me?.role === "owner"}
        me={mine}
      />
    </div>
  );
}
