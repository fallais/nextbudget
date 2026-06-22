import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { transactionHash } from "./hash";

describe("transactionHash", () => {
  it("is sha256(date|amountCents|normalizedDescription)", () => {
    const h = transactionHash({
      date: "2026-06-01",
      amountCents: -4500,
      normalizedDescription: "CARREFOUR MARKET",
    });
    const expected = createHash("sha256")
      .update("2026-06-01|-4500|CARREFOUR MARKET")
      .digest("hex");
    expect(h).toBe(expected);
  });

  it("changes when any field changes", () => {
    const a = transactionHash({ date: "2026-06-01", amountCents: -4500, normalizedDescription: "X" });
    const b = transactionHash({ date: "2026-06-01", amountCents: -4501, normalizedDescription: "X" });
    const c = transactionHash({ date: "2026-06-02", amountCents: -4500, normalizedDescription: "X" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
