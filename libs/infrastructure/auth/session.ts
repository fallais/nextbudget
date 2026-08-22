import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getDataSource } from "@infrastructure/persistence/client";
import { SessionEntity, UserEntity } from "@infrastructure/persistence/schemas";
import type { UserRow } from "@domain/entities";

const COOKIE = "nextbudget_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Did this request reach us over HTTPS?
 *
 * Next's server speaks HTTP and nothing else — TLS is always terminated by
 * something in front of it, which says so in `x-forwarded-proto`. So that
 * header is the entire signal, and its absence means plain HTTP.
 *
 * This decides the session cookie's `Secure` flag, and the flag has to follow
 * the request rather than the build: marking it Secure because NODE_ENV says
 * `production` — which every published image says — makes a browser discard
 * the cookie outright on a LAN install served over `http://host:8003`. The
 * login succeeds, sets nothing, and lands back on the form with no error to
 * explain itself. Whereas behind a TLS proxy, the header is there and the
 * cookie is Secure, which is when it actually buys something.
 */
async function isHttps(): Promise<boolean> {
  // A chain of proxies appends rather than replaces: "https, http". The hop
  // that faced the client is the first one.
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0];
  return proto?.trim().toLowerCase() === "https";
}

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
    secure: await isHttps(),
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
export async function getSessionUser(): Promise<UserRow | null> {
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
