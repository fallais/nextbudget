import next from "eslint-config-next";

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
