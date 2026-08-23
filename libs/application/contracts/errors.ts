import "server-only";
export { isUniqueViolation } from "@infrastructure/persistence/errors";

/**
 * Driver failures the edge has to answer for, named by the application.
 *
 * The HTTP layer needs to know that a write lost a race with a unique index,
 * because that is a 409 and nothing else is. What it does not need to know is
 * that the answer comes from a Postgres SQLSTATE: re-exporting here keeps the
 * knowledge of *which* driver on the application's side of the line, so
 * swapping it is one file rather than a hunt through the route handlers.
 *
 * A thin file on purpose. The alternative is either the edge importing the pg
 * driver's error shapes directly, or every use case catching and re-throwing a
 * translated error it has nothing else to say about.
 */
