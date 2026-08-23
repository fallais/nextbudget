import "server-only";

/**
 * Listing what is stored.
 *
 * A facade over read models. Filtering, paging and joining rows for a screen
 * rebuilds no aggregate and enforces no rule, so the queries themselves live
 * in `@infrastructure/persistence/queries/queries` and this exposes them.
 *
 * The indirection is the point rather than an accident: `app/` may import
 * `@application` and nothing further, so how these are computed stays behind
 * a line the delivery layer cannot reach across.
 */
export * from "@infrastructure/persistence/queries/queries";
