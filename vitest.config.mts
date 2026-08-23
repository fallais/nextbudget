// NB: no `defineConfig` from "vitest/config" — in vitest 4.1.9 that subpath's
// types entry (`config.d.ts`) re-exports from "vitest/config", which resolves
// back to itself, so nothing is exported and `tsc --noEmit` fails. A plain
// object checked against `TestUserConfig` keeps the type safety without the
// cycle. Revisit once vitest ships a non-self-referential types entry.
import path from "node:path";
import type { TestUserConfig } from "vitest/node";

const root = process.cwd();

export default {
  // Vitest does not read tsconfig `paths`, so the layer aliases are repeated
  // here. Keep both in sync.
  resolve: {
    alias: {
      "@domain": path.resolve(root, "libs/domain"),
      "@application": path.resolve(root, "libs/application"),
      "@infrastructure": path.resolve(root, "libs/infrastructure"),
      "@shared": path.resolve(root, "libs/shared"),
      "@": root,
      // `server-only` throws on import outside a Server Component, which is the
      // whole point of it — but it also means anything importing it is
      // untestable. Stub it so the repositories can be unit-tested; the real
      // guard still applies in `next build`, which is where it matters.
      "server-only": path.resolve(root, "libs/shared/testing/server-only-stub.ts"),
    },
  },
  test: {
    include: ["libs/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // `text` for the terminal, `lcov` for Codecov, `json-summary` so the
      // number can be read back without parsing a report.
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      /**
       * Measured over `libs/` only, and honestly within it.
       *
       * `app/` and `components/` are excluded because nothing here can run
       * them: the suite has no jsdom and no Next runtime, so including them
       * would report zero for half the repository and say nothing about
       * whether the tests are any good. They are covered by the build,
       * typecheck and the manual checks, not by this number.
       *
       * What is *not* excluded is the persistence layer, even though it needs
       * a database this suite does not have. It is genuinely untested, and a
       * coverage number that hides its own gaps is worth less than a low one.
       */
      include: ["libs/**/*.ts"],
      exclude: [
        "libs/**/*.test.ts",
        "libs/shared/testing/**",
        // Type-only modules: no statements to cover, and counting them as
        // fully covered would flatter the total.
        "libs/domain/repositories/**",
        "libs/domain/enums/**",
        "libs/domain/entities/index.ts",
        "libs/infrastructure/persistence/schemas/**",
      ],
    },
  },
} satisfies { test: TestUserConfig; resolve: { alias: Record<string, string> } };
