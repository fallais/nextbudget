import { describe, it, expect } from "vitest";
import { normalizeDescription } from "./normalize";

describe("normalizeDescription", () => {
  it("uppercases, strips accents and collapses whitespace", () => {
    expect(normalizeDescription("  Café   Crème  ")).toBe("CAFE CREME");
  });

  it("replaces disallowed characters with a space", () => {
    expect(normalizeDescription("EDF (Énergie)")).toBe("EDF ENERGIE");
  });

  it("keeps digits and allowed symbols", () => {
    expect(normalizeDescription("CB A61/Péage +1.50&")).toBe("CB A61/PEAGE +1.50&");
  });
});
