import "server-only";

/**
 * What is left to live on once the month's commitments are counted.
 *
 * A facade over read models: the figures are SQL aggregates with no entity in
 * the middle, so the queries live in
 * `@infrastructure/persistence/queries/reste-a-vivre`.
 */
export * from "@infrastructure/persistence/queries/reste-a-vivre";
