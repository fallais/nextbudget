import { describe, it, expect } from "vitest";
import { z } from "zod";
import { describeValidationError } from "./validation-error";
import { assetInputSchema, accountInputSchema } from "./validation";

/** The string a route would answer with, for a body that fails `schema`. */
function messageFor(schema: z.ZodType, body: unknown): string {
  const parsed = schema.safeParse(body);
  if (parsed.success) throw new Error("expected the body to be rejected");
  return describeValidationError(parsed.error);
}

describe("describeValidationError", () => {
  it("names the field and the accepted values", () => {
    // The credit form's own failure: a POST arriving with no `kind`.
    const msg = messageFor(assetInputSchema, { name: "Crédit maison", type: "mortgage" });
    expect(msg).toContain("kind");
    expect(msg).toContain("asset");
    expect(msg).toContain("liability");
    // And none of the JSON that used to reach the screen.
    expect(msg).not.toContain("{");
    expect(msg).not.toContain("[");
  });

  it("calls a missing field obligatoire", () => {
    expect(messageFor(accountInputSchema, {})).toContain("obligatoire");
  });

  it("points at the element inside an array", () => {
    const msg = messageFor(assetInputSchema, {
      name: "Prêt",
      kind: "liability",
      owners: [{ personId: 1, shareBps: 99999 }],
    });
    expect(msg).toContain("owners.0.shareBps");
    expect(msg).toContain("10000");
  });

  it("stops at three issues and says how many are left", () => {
    const schema = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string(), e: z.string() });
    const msg = messageFor(schema, {});
    expect(msg).toContain("(et 2 autres)");
  });

  it("says something even with no issues to report", () => {
    expect(describeValidationError({ issues: [] } as unknown as z.ZodError)).toBe("Données invalides");
  });
});
