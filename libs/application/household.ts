import "server-only";
import { In } from "typeorm";
import { getDataSource } from "@infrastructure/persistence/client";
import { PersonEntity, UserEntity } from "@infrastructure/persistence/schemas";
import type { Person, PersonRow, NewPerson, UserRow } from "@domain/entities";
import type { Repository } from "@domain/repositories";
import type { z } from "zod";
import type { personInputSchema } from "./contracts/validation";
import { contributions, persons } from "@infrastructure/persistence/repositories";

/**
 * The household: who lives here, and which of them can log in.
 *
 * `persons` is the domain concept — everyone whose money the app tracks.
 * `users` is the auth concept — who has a password. They are deliberately
 * separate: in open mode nobody logs in, yet ownership shares and
 * contributions still need a subject. `persons.user_id` links the two when
 * a member does have a login.
 */

export type MemberUser = Pick<UserRow, "id" | "name" | "email" | "role" | "isActive">;

export type Member = {
  person: PersonRow;
  user: MemberUser | null;
};

function toMemberUser(u: UserRow): MemberUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive };
}

export async function listMembers(): Promise<Member[]> {
  const ds = await getDataSource();
  const persons = await ds.getRepository(PersonEntity).find({ order: { name: "ASC" } });
  const linkedIds = persons.map((p) => p.userId).filter((v): v is number => v != null);
  const users: UserRow[] = linkedIds.length
    ? await ds.getRepository(UserEntity).findBy({ id: In(linkedIds) })
    : [];
  const byId = new Map(users.map((u) => [u.id, toMemberUser(u)]));
  return persons.map((p) => ({
    person: p,
    user: p.userId != null ? (byId.get(p.userId) ?? null) : null,
  }));
}

/** The person a login speaks for, if the link has been made. */
export async function getPersonForUser(userId: number): Promise<PersonRow | null> {
  const ds = await getDataSource();
  return ds.getRepository(PersonEntity).findOne({ where: { userId } });
}

/**
 * True when `userId` is already claimed by a different person. One login maps
 * to at most one household member; enforced in app code because there are no
 * DB-level constraints here.
 */
export async function isUserLinkTaken(userId: number, exceptPersonId?: number): Promise<boolean> {
  const ds = await getDataSource();
  const existing = await ds.getRepository(PersonEntity).findOne({ where: { userId } });
  return !!existing && existing.id !== exceptPersonId;
}

/**
 * Remove a household member, and with them the contributions they own.
 *
 * A person is an aggregate root: contributions are recorded against them and
 * mean nothing once the person is gone. Deleting the person alone would leave
 * rows keyed to a missing `person_id` — the schema has no FK to stop that, so
 * the cascade is here.
 *
 * Resolves `false` when no such person exists.
 */
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
