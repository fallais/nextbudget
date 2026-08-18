/**
 * Stand-in for the `server-only` package under vitest.
 *
 * The real module throws the moment it is imported outside a React Server
 * Component, which is exactly what makes it useful in `next build` and exactly
 * what makes any module importing it impossible to unit-test. Vitest aliases
 * `server-only` here (see `vitest.config.mts`); nothing else imports this file.
 */
export {};
