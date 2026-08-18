import type { User, UserRow, NewUser } from "@domain/entities";
import type { Repository } from "./repository";

export interface UserRepository extends Repository<User, UserRow, NewUser> {
  /** Login accepts either an email or a name; inactive accounts never match. */
  findActiveByIdentifier(identifier: string): Promise<User | null>;

  /** Guards the "last owner" rule — the household must keep someone who can administer it. */
  countActiveOwners(): Promise<number>;

  /**
   * Delete a user and detach everything that referenced them: sessions go
   * (a token for a deleted account must stop working), while owned rows are
   * merely unstamped — the account, rule or asset still exists, it just has no
   * owner. With no FK constraints in the schema, this is where that lives.
   */
  deleteWithReferences(userId: number): Promise<boolean>;
}
