import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { describeValidationError } from "@application/contracts/validation-error";
import { isDomainError } from "@domain/errors";
import { isUniqueViolation } from "@application/contracts/errors";

/**
 * The HTTP edge: turning domain outcomes into status codes.
 *
 * This is the only place that knows a broken invariant is a 400 and a unique
 * clash is a 409. Routes were each re-deriving that (and mostly not handling
 * `DomainError` at all, so a rejected invariant surfaced as a 500 with a stack
 * trace instead of the French message the entity carefully wrote).
 *
 * `_lib` is a Next private folder — the underscore keeps it out of routing.
 */

/** Route params are strings; anything not a positive integer is not an id. */
export function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * A rejected request. Hand it a `ZodError` rather than its `.message`: that
 * property is the issue list as JSON, and it used to arrive on screen intact.
 */
export const badRequest = (error: string | ZodError) =>
  NextResponse.json(
    { error: typeof error === "string" ? error : describeValidationError(error) },
    { status: 400 },
  );
export const notFound = (error = "Introuvable") => NextResponse.json({ error }, { status: 404 });
export const conflict = (error: string) => NextResponse.json({ error }, { status: 409 });
export const ok = () => NextResponse.json({ ok: true });

/**
 * Run a handler, mapping thrown domain/driver errors to the right status.
 * `conflictMessage` is what the user reads when a unique index rejects a write.
 */
export async function handle(
  fn: () => Promise<NextResponse>,
  conflictMessage?: string,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (isDomainError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (isUniqueViolation(err)) {
      return conflict(conflictMessage ?? "Cet enregistrement existe déjà");
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
