import { listAssets } from "@application/assets";
import { listAllAccounts } from "@application/queries";
import { getPersonForUser, listMembers } from "@application/household";
import { getCurrentUser } from "@application/auth";
import { NewCreditForm } from "@/components/credits/new-credit-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creating a loan is a page, not a dialog.
 *
 * There are twenty fields, several of which need reading off a contract, and
 * the form computes as you type — the échéance, the implied TAEG, the deferral.
 * A modal is the wrong container for that much thinking.
 */
export default async function NewCreditPage() {
  const [assets, accounts, members, me] = await Promise.all([
    listAssets(),
    listAllAccounts(),
    listMembers(),
    getCurrentUser(),
  ]);
  const mePerson = me ? await getPersonForUser(me.id) : null;

  return (
    <NewCreditForm
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      persons={members.map((m) => ({ id: m.person.id, name: m.person.name }))}
      mePersonId={mePerson?.id ?? null}
      linkableAssets={assets
        .filter((a) => a.kind === "asset")
        .map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
