import type { ZodError } from "zod";

/**
 * A rejected request, in a sentence someone can act on.
 *
 * Routes used to answer with `parsed.error.message`, which in Zod 4 is the
 * issue list serialised as JSON. What reached the screen was a paragraph of
 * `[{"code":"invalid_value","expected":"…"}]` — technically complete, and no
 * help at all in a toast: the one useful fact, *which field*, was buried in a
 * `path` array halfway through.
 *
 * The codes are translated where the translation is worth having and the
 * issue's own message is kept where it is not. Three issues at most: a form
 * with eight problems needs a form telling you so field by field, not a
 * longer toast.
 */

/** The parts of a Zod issue this reads. Structural, so it survives Zod's own churn. */
type Issue = {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: string;
  values?: unknown[];
  minimum?: number | bigint;
  maximum?: number | bigint;
};

const MAX_ISSUES = 3;

function fieldOf(issue: Issue): string {
  return issue.path.length > 0 ? issue.path.map(String).join(".") : "corps de la requête";
}

function reasonOf(issue: Issue): string {
  switch (issue.code) {
    case "invalid_value":
      return issue.values?.length
        ? `valeur attendue : ${issue.values.map(String).join(", ")}`
        : "valeur invalide";
    case "invalid_type":
      // Zod reports an absent key as a type error against `undefined`, which
      // is the single most common failure and deserves its own words.
      return issue.message.includes("undefined")
        ? "champ obligatoire"
        : `type attendu : ${issue.expected ?? "autre"}`;
    case "too_small":
      return `valeur minimale : ${issue.minimum}`;
    case "too_big":
      return `valeur maximale : ${issue.maximum}`;
    case "invalid_format":
      return "format invalide";
    default:
      return issue.message;
  }
}

export function describeValidationError(error: ZodError): string {
  const issues = (error.issues as unknown as Issue[]) ?? [];
  if (issues.length === 0) return "Données invalides";

  const described = issues
    .slice(0, MAX_ISSUES)
    .map((issue) => `${fieldOf(issue)} : ${reasonOf(issue)}`)
    .join(" · ");
  const rest = issues.length - MAX_ISSUES;

  return `Données invalides — ${described}${rest > 0 ? ` (et ${rest} autre${rest > 1 ? "s" : ""})` : ""}`;
}
