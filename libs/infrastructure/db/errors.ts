/**
 * Postgres unique_violation (23505). The schema has no FK constraints but does
 * carry unique indexes — transaction hashes per account, user emails — so a
 * clash arrives as a driver error that must be turned into a useful message
 * rather than a bare 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string }; message?: string };
  return (
    e?.code === "23505" ||
    e?.driverError?.code === "23505" ||
    (typeof e?.message === "string" && e.message.includes("duplicate key"))
  );
}
