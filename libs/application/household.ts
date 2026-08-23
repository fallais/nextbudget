import "server-only";
import { contributions, persons } from "@infrastructure/persistence/repositories";
import { isUserLinkTaken } from "@infrastructure/persistence/queries/household";
import type { Person, PersonRow, NewPerson } from "@domain/entities";
import type { Repository } from "@domain/repositories";
import type { z } from "zod";
import type { personInputSchema } from "./contracts/validation";

/**
 * The household: the writes, plus the read models re-exported.
 */
export * from "@infrastructure/persistence/queries/household";

export async function deletePerson(personId: number, deps: PersonDeps = LIVE): Promise<boolean> {
  const person = await deps.persons.findById(personId);
  if (!person) return false;

  await deps.contributions.deleteByPerson(personId);
  return deps.persons.delete(personId);
}

type PersonRepo = Repository<Person, PersonRow, NewPerson>;

export type PersonDeps = {
  persons: Pick<PersonRepo, "findById" | "create" | "update" | "delete">;
  contributions: Pick<typeof contributions, "deleteByPerson">;
  isUserLinkTaken: (userId: number, exceptPersonId?: number) => Promise<boolean>;
};

const LIVE: PersonDeps = { persons, contributions, isUserLinkTaken };

export type PersonInput = z.infer<typeof personInputSchema>;

export type PersonWriteResult =
  | { ok: true; person: PersonRow }
  | { ok: false; reason: "user_taken" }
  | { ok: false; reason: "not_found" };

/**
 * Add a household member.
 *
 * The one-login-one-person rule is checked here rather than in the route,
 * which is where it used to live in two copies — once for create and once for
 * update, each free to drift from the other.
 */
export async function createPerson(
  input: PersonInput,
  deps: PersonDeps = LIVE,
): Promise<PersonWriteResult> {
  const userId = input.userId ?? null;
  if (userId != null && (await deps.isUserLinkTaken(userId))) {
    return { ok: false, reason: "user_taken" };
  }
  const created = await deps.persons.create({
    name: input.name,
    userId,
    monthlySalaryCents: input.monthlySalaryCents ?? null,
    matchPattern: input.matchPattern ?? null,
    matchType: input.matchType ?? "contains",
    tolerancePct: input.tolerancePct,
    isActive: input.isActive,
  });
  return { ok: true, person: created.toRow() };
}

export async function updatePerson(
  personId: number,
  patch: Partial<PersonInput>,
  deps: PersonDeps = LIVE,
): Promise<PersonWriteResult> {
  if (patch.userId != null && (await deps.isUserLinkTaken(patch.userId, personId))) {
    return { ok: false, reason: "user_taken" };
  }
  const updated = await deps.persons.update(personId, patch);
  return updated ? { ok: true, person: updated.toRow() } : { ok: false, reason: "not_found" };
}
