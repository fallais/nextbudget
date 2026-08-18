import { listAllAccounts, listRecentImports } from "@application/queries";
import { ImportView } from "@/components/import/import-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [history, accounts] = await Promise.all([listRecentImports(), listAllAccounts()]);

  return (
    <ImportView
      history={history}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
    />
  );
}
