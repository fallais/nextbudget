import { AggregateRoot } from "@domain/ddd";
import { invariant } from "@domain/errors";

import type { UserRole } from "@domain/enums";

export interface UserRow {
  id: number;
  name: string;
  email: string | null;
  passwordHash: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export type NewUser = Omit<UserRow, "id" | "createdAt">;

/** A login. The person behind it is a `Person`; the two are linked, not merged. */
export class User extends AggregateRoot<UserRow> {
  private constructor(row: UserRow) {
    super(row);
  }

  static reconstitute(row: UserRow): User {
    return new User(row);
  }

  static create(input: NewUser): User {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "user.name_required");
    return new User({ ...input, id: 0, createdAt: new Date() });
  }

  get name(): string {
    return this.row.name;
  }
  get role(): UserRole {
    return this.row.role;
  }
  get isOwner(): boolean {
    return this.row.role === "owner";
  }

  /** Can this login actually be used? Enforced auth needs a password. */
  get canSignIn(): boolean {
    return this.row.isActive && this.row.passwordHash !== null;
  }

  /** Never let the hash leave the server by accident. */
  toPublic(): Omit<UserRow, "passwordHash"> & { hasPassword: boolean } {
    const { passwordHash, ...rest } = this.row;
    return { ...rest, hasPassword: passwordHash !== null };
  }

}
