/**
 * The handful of household facts that live in a table rather than in env.
 *
 * A key-value port rather than an entity: these are single strings with no
 * invariant to protect, and wrapping each in an aggregate would be ceremony
 * for a row that says `couple`.
 */
export interface SettingsRepository {
  /** Resolves `null` when the key has never been set. */
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;

  /**
   * Turn on enforced auth, and give the owner the password that will satisfy
   * it, in one transaction.
   *
   * The two writes cannot be separated: a mode set without a password stored
   * is an install that demands a login nobody can perform, recoverable only by
   * `npm run auth:reset` on the server. It lives on this port rather than the
   * user one because the setting is the point and the password is what makes
   * flipping it safe.
   */
  enableEnforcedAuth(ownerId: number, passwordHash: string, email?: string): Promise<void>;
}
