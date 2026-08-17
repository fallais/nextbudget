// NB: no `defineConfig` from "vitest/config" — in vitest 4.1.9 that subpath's
// types entry (`config.d.ts`) re-exports from "vitest/config", which resolves
// back to itself, so nothing is exported and `tsc --noEmit` fails. A plain
// object checked against `TestUserConfig` keeps the type safety without the
// cycle. Revisit once vitest ships a non-self-referential types entry.
import type { TestUserConfig } from "vitest/node";

export default {
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
} satisfies { test: TestUserConfig };
