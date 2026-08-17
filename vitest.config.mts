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
    },
  },
  test: {
    include: ["libs/**/*.test.ts"],
    environment: "node",
  },
} satisfies { test: TestUserConfig; resolve: { alias: Record<string, string> } };
