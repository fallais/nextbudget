import { describe, it, expect } from "vitest";
import { changeUserRole, createUser, deleteUser, updateUser, type UserDeps } from "./users";
import { User, type UserRow } from "@domain/entities";

/**
 * The rule under test is that the household must always keep somebody who can
 * administer it. An install whose last owner has been demoted, deactivated or
 * deleted cannot be configured again without `auth:reset` on the server, so
 * every path that could strand it is checked here rather than trusted.
 */

const owner: UserRow = {
  id: 1,
  name: "Propriétaire",
  email: "o@example.com",
  role: "owner",
  isActive: true,
  passwordHash: "argon2:existing",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};
const member: UserRow = { ...owner, id: 2, name: "Membre", email: "m@example.com", role: "member" };

const never = () => {
  throw new Error("should not have been called");
};

function deps(over: {
  find?: UserRow | null;
  owners?: number;
  onUpdate?: (id: number, patch: Partial<UserRow>) => void;
  onDelete?: (id: number) => void;
} = {}): UserDeps {
  const found = over.find === undefined ? owner : over.find;
  return {
    users: {
      findAll: async () => [User.reconstitute(owner), User.reconstitute(member)],
      findById: async () => (found ? User.reconstitute(found) : null),
      create: async (input) => User.reconstitute({ ...owner, ...input, id: 9 } as UserRow),
      update: async (id, patch) => {
        over.onUpdate?.(id, patch as Partial<UserRow>);
        return User.reconstitute({ ...found!, ...patch } as UserRow);
      },
      countActiveOwners: async () => over.owners ?? 2,
      deleteWithReferences: async (id) => {
        over.onDelete?.(id);
        return true;
      },
    },
    hashPassword: async (plain) => `hashed:${plain}`,
  };
}

describe("the last owner", () => {
  it("cannot be demoted to a member", () => {
    return expect(changeUserRole(1, { role: "member" }, deps({ owners: 1 }))).resolves.toEqual({
      ok: false,
      reason: "last_owner",
    });
  });

  it("cannot be deactivated either, which strands the household just as well", async () => {
    expect(await changeUserRole(1, { isActive: false }, deps({ owners: 1 }))).toEqual({
      ok: false,
      reason: "last_owner",
    });
  });

  it("cannot be deleted", async () => {
    let deleted = false;
    const d = deps({ owners: 1, onDelete: () => (deleted = true) });
    expect(await deleteUser(1, d)).toEqual({ ok: false, reason: "last_owner" });
    expect(deleted).toBe(false);
  });

  it("may be demoted once there is a second owner", async () => {
    expect(await changeUserRole(1, { role: "member" }, deps({ owners: 2 }))).toEqual({ ok: true });
  });

  it("may still be renamed, which strands nobody", async () => {
    expect(await changeUserRole(1, {}, deps({ owners: 1 }))).toEqual({ ok: true });
  });
});

describe("a member", () => {
  it("is not protected by the owner rule", async () => {
    const d = deps({ find: member, owners: 1 });
    expect(await changeUserRole(2, { isActive: false }, d)).toEqual({ ok: true });
    expect(await deleteUser(2, d)).toEqual({ ok: true });
  });
});

describe("a user who does not exist", () => {
  it("is reported as missing rather than guarded", async () => {
    const d = deps({ find: null });
    expect(await changeUserRole(404, { role: "member" }, d)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await deleteUser(404, d)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("passwords", () => {
  it("are hashed on the way in, never stored as typed", async () => {
    let written: Partial<UserRow> = {};
    await createUser(
      { name: "N", email: null, role: "member", isActive: true, password: "secret" },
      { ...deps(), users: { ...deps().users, create: async (input) => {
        written = input as Partial<UserRow>;
        return User.reconstitute({ ...member, ...input } as UserRow);
      } } },
    );
    expect(written.passwordHash).toBe("hashed:secret");
    // The plain text must not reach the row under any key of its own.
    expect(written).not.toHaveProperty("password");
  });

  it("are left alone by an update that does not mention one", async () => {
    let patch: Partial<UserRow> = {};
    await updateUser(1, { name: "Renommé" }, deps({ onUpdate: (_id, p) => (patch = p) }));
    expect(patch).not.toHaveProperty("passwordHash");
    expect(patch.name).toBe("Renommé");
  });

  it("are replaced when an update does carry one", async () => {
    let patch: Partial<UserRow> = {};
    await updateUser(1, { password: "nouveau" }, deps({ onUpdate: (_id, p) => (patch = p) }));
    expect(patch.passwordHash).toBe("hashed:nouveau");
    // The plain text must not survive into the row.
    expect(patch).not.toHaveProperty("password");
  });

  it("are not written at all when the guard refuses the change", async () => {
    const d = deps({ owners: 1, onUpdate: never });
    expect(await updateUser(1, { role: "member", password: "x" }, d)).toEqual({
      ok: false,
      reason: "last_owner",
    });
  });
});
