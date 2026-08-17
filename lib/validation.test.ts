import { describe, it, expect } from "vitest";
import { z } from "zod";
import { patchSchema, assetInputSchema, accountInputSchema } from "./validation";

describe("patchSchema", () => {
  it("does not materialise defaults for omitted keys", () => {
    // The trap: z.object({...}).partial() keeps .default(), so a PATCH body
    // that omits a field still parses to that field's default, and the route
    // then writes it over the stored value.
    const input = z.object({
      name: z.string(),
      type: z.enum(["a", "b"]).default("a"),
      count: z.number().default(0),
    });
    expect(input.partial().parse({ name: "x" })).toEqual({
      name: "x",
      type: "a",
      count: 0,
    });
    expect(patchSchema(input).parse({ name: "x" })).toEqual({ name: "x" });
  });

  it("still parses and validates the keys that are present", () => {
    const input = z.object({ n: z.number().min(0).default(0) });
    expect(patchSchema(input).parse({ n: 5 })).toEqual({ n: 5 });
    expect(patchSchema(input).safeParse({ n: -1 }).success).toBe(false);
  });

  it("leaves an asset's stored fields alone when only owners are sent", () => {
    const parsed = patchSchema(assetInputSchema).parse({
      owners: [{ personId: 1, shareBps: 10000 }],
    });
    expect(parsed).toEqual({ owners: [{ personId: 1, shareBps: 10000 }] });
    expect(parsed).not.toHaveProperty("type");
    expect(parsed).not.toHaveProperty("valueCents");
  });

  it("leaves an account's kind alone when only the name is sent", () => {
    const parsed = patchSchema(accountInputSchema).parse({ name: "Livret A" });
    expect(parsed).toEqual({ name: "Livret A" });
    expect(parsed).not.toHaveProperty("kind");
    expect(parsed).not.toHaveProperty("visibility");
  });
});
