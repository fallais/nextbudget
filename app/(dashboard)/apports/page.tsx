import { getContributionsByPersonWithStatus } from "@/lib/db/contributions";
import { PersonsPane } from "@/components/persons/persons-pane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ApportsPage() {
  const perPerson = await getContributionsByPersonWithStatus();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Apports</h2>
        <p className="text-sm text-muted-foreground">
          Suivez les apports mensuels au Compte commun. Chaque personne peut
          avoir plusieurs apports (un pour le loyer, un pour EDF, etc.). Le
          salaire est informationnel.
        </p>
      </div>
      <PersonsPane perPerson={perPerson} />
    </div>
  );
}
