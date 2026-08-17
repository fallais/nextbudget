/**
 * A broken domain rule.
 *
 * Thrown by entity factories and value objects when input would produce an
 * invalid object. API routes translate it to a 400 with `message` shown to the
 * user, so messages are written in French and for a person, not a log.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    /** Stable machine-readable code, e.g. "asset.shares_total". */
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function invariant(
  condition: unknown,
  message: string,
  code: string,
): asserts condition {
  if (!condition) throw new DomainError(message, code);
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
