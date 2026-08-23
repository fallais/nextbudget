import { describe, it, expect } from "vitest";
import { login, type LoginDeps } from "./index";
import { User, type UserRow } from "@domain/entities";

/**
 * Signing in, and the property that matters more than the happy path.
 *
 * Every failure has to be indistinguishable from every other: an unknown
 * account, an account with no password, and a wrong password must all look the
 * same from outside. Distinguishing them turns the login form into a way of
 * asking which names exist. That is a security property, which is why it is
 * here and not in a route handler where the next edit could widen it without
 * anyone noticing.
 */

const account: UserRow = {
  id: 1,
  name: "Alex",
  email: "alex@example.com",
  role: "owner",
  isActive: true,
  passwordHash: "argon2:correct",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function deps(over: {
  found?: UserRow | null;
  verifies?: boolean;
  onSession?: (id: number) => void;
} = {}): LoginDeps {
  const found = over.found === undefined ? account : over.found;
  return {
    users: { findActiveByIdentifier: async () => (found ? User.reconstitute(found) : null) },
    verifyPassword: async () => over.verifies ?? true,
    createSession: async (id) => {
      over.onSession?.(id);
    },
  };
}

describe("login", () => {
  it("opens a session for the right password", async () => {
    let sessionFor = 0;
    const ok = await login("alex@example.com", "correct", deps({ onSession: (id) => (sessionFor = id) }));
    expect(ok).toBe(true);
    expect(sessionFor).toBe(1);
  });

  it("refuses an unknown account without opening a session", async () => {
    let opened = false;
    const ok = await login("nobody@example.com", "x", deps({ found: null, onSession: () => (opened = true) }));
    expect(ok).toBe(false);
    expect(opened).toBe(false);
  });

  it("refuses a wrong password", async () => {
    let opened = false;
    const ok = await login("alex@example.com", "wrong", deps({ verifies: false, onSession: () => (opened = true) }));
    expect(ok).toBe(false);
    expect(opened).toBe(false);
  });

  it("refuses an account that has no password set", async () => {
    // An install left in open mode has users with no hash. They must not
    // become a way in the moment auth is enforced.
    let opened = false;
    const ok = await login(
      "alex@example.com",
      "anything",
      deps({ found: { ...account, passwordHash: null }, onSession: () => (opened = true) }),
    );
    expect(ok).toBe(false);
    expect(opened).toBe(false);
  });

  it("never verifies against a hash that is not there", async () => {
    // Calling the verifier with null would be an argon2 error, and an error is
    // a different observable outcome from a refusal.
    const d: LoginDeps = {
      ...deps({ found: { ...account, passwordHash: null } }),
      verifyPassword: async () => {
        throw new Error("verifier must not be reached");
      },
    };
    await expect(login("alex@example.com", "x", d)).resolves.toBe(false);
  });

  it("answers the same way for every kind of failure", async () => {
    // The whole point: three different reasons, one indistinguishable answer.
    const unknown = await login("nobody", "x", deps({ found: null }));
    const wrong = await login("alex", "x", deps({ verifies: false }));
    const noPassword = await login("alex", "x", deps({ found: { ...account, passwordHash: null } }));
    expect([unknown, wrong, noPassword]).toEqual([false, false, false]);
  });
});
