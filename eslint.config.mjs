import next from "eslint-config-next";

/**
 * Two dependencies are deliberately not on their latest major, and this file is
 * why: `eslint-config-next` bundles its own `typescript-eslint` and
 * `eslint-plugin-react`. The first refuses to load under TypeScript 7, the
 * second calls `context.getFilename()`, removed in ESLint 10. So the repo sits
 * on TypeScript 6 and ESLint 9 until eslint-config-next ships plugins that
 * clear both — bumping either alone only breaks `npm run lint`.
 */

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...next,
  {
    rules: {
      // French UI copy contains apostrophes; escaping them adds noise.
      "react/no-unescaped-entities": "off",
      // Forms reset local state when a dialog opens — a legitimate pattern here.
      "react-hooks/set-state-in-effect": "off",
      // Dynamic icon components are resolved at render from a name — intended.
      "react-hooks/static-components": "off",
    },
  },
  {
    /**
     * The layering rule, enforced rather than described.
     *
     * `app/` is delivery: it parses input, calls a use case and maps the result
     * to HTTP. Reaching past `@application` into a repository is how business
     * decisions end up in route handlers, one convenient line at a time — which
     * is exactly how twenty-three of them got there before this rule existed.
     *
     * Types are exempt: a handler naming the shape it returns couples nothing
     * at runtime, and the alternative is re-declaring every DTO at the edge.
     */
    files: ["app/**/*.ts", "app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@infrastructure/*", "@infrastructure"],
              allowTypeImports: true,
              message:
                "app/ talks to @application, never to infrastructure. Put the operation in a use case.",
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * The domain depends on nothing. It is the one layer where that is
     * absolute: entities and services must be reachable without a database, a
     * network, or a framework being present.
     */
    files: ["libs/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@application/*", "@infrastructure/*", "@/*", "next/*", "typeorm"],
              message: "The domain imports nothing outward. Move this to @application.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
