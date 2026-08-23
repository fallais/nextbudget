import "server-only";

/**
 * Where the balance is heading.
 *
 * A read model like the rest: it rebuilds no aggregate and enforces no rule,
 * so the query lives in `@infrastructure/persistence/queries/projection` and
 * this is the door `app/` comes in through. The arithmetic it leans on is not
 * a query at all, it is `@domain/services/projection`, which is where the walk
 * and its rules are tested.
 */
export * from "@infrastructure/persistence/queries/projection";
