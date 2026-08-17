import "server-only";
import { In } from "typeorm";
import { getDataSource } from "@infrastructure/db/client";
import { PersonEntity, UserEntity } from "@infrastructure/db/schemas";
import type { Person, User } from "@domain/entities";

/**
 * The household: who lives here, and which of them can log in.
 *
 * `persons` is the domain concept — everyone whose money the app tracks.
 * `users` is the auth concept — who has a password. They are deliberately
 * separate: in open mode nobody logs in, yet ownership shares and
 * contributions still need a subject. `persons.user_id` links the two when
 * a member does have a login.
 */

export type MemberUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

export type Member = {
  person: Person;
  user: MemberUser | null;
};

function toMemberUser(u: User): MemberUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive };
}

export async function listMembers(): Promise<Member[]> {
  const ds = await getDataSource();
  const persons = await ds.getRepository(PersonEntity).find({ order: { name: "ASC" } });
  const linkedIds = persons.map((p) => p.userId).filter((v): v is number => v != null);
  const users: User[] = linkedIds.length
    ? await ds.getRepository(UserEntity).findBy({ id: In(linkedIds) })
    : [];
  const byId = new Map(users.map((u) => [u.id, toMemberUser(u)]));
  return persons.map((p) => ({
    person: p,
    user: p.userId != null ? (byId.get(p.userId) ?? null) : null,
  }));
}

/** The person a login speaks for, if the link has been made. */
export async function getPersonForUser(userId: number): Promise<Person | null> {
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
