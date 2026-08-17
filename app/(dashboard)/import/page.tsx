import { getDataSource } from "@/lib/db/client";
import { ImportEntity } from "@/lib/db/entities";
import { listAllAccounts } from "@/lib/db/queries";
import { ImportButton } from "@/components/import/import-button";
import { ImportsHistory } from "@/components/import/imports-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const ds = await getDataSource();
  const [history, accounts] = await Promise.all([
    ds.getRepository(ImportEntity).find({ order: { startedAt: "DESC" }, take: 50 }),
    listAllAccounts(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Importer des relevés</h2>
          <p className="text-sm text-muted-foreground">
            Cliquez sur Importer et sélectionnez vos fichiers à téléverser.
            Formats acceptés : <code className="text-xs">.csv</code>,{" "}
            <code className="text-xs">.tsv</code>, <code className="text-xs">.txt</code>.
          </p>
        </div>
        <ImportButton
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Historique des imports</h3>
        <ImportsHistory imports={history} />
      </div>
    </div>
  );
}
