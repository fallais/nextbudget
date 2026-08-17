import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDataSource } from "@infrastructure/db/client";
import { SessionEntity, UserEntity } from "@infrastructure/db/schemas";
import type { User } from "@domain/entities";

const COOKIE = "banquejs_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Create a session for a user and set the session cookie (route handlers only). */
export async function createSession(userId: number): Promise<void> {
  const ds = await getDataSource();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  await ds.getRepository(SessionEntity).insert({ id: token, userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

/** Delete the current session (DB row + cookie). */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const ds = await getDataSource();
    await ds.getRepository(SessionEntity).delete({ id: token });
    jar.delete(COOKIE);
  }
}

/** Resolve the user behind the current session cookie, or null. */
export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const ds = await getDataSource();
  const sessionRepo = ds.getRepository(SessionEntity);
  const session = await sessionRepo.findOne({ where: { id: token } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await sessionRepo.delete({ id: token });
    return null;
  }

  const user = await ds.getRepository(UserEntity).findOne({ where: { id: session.userId } });
  return user && user.isActive ? user : null;
}
