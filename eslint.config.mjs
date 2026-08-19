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
];

export default eslintConfig;
