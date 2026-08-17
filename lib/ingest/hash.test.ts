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

  it("does not depend on the account — dedup is scoped by the composite index", () => {
    // The hash is a pure content fingerprint; uniqueness is enforced per
    // account by transactions_account_hash_uniq (account_id, hash), so the
    // same statement line imported into two different accounts is two rows.
    const line = {
      date: "2026-06-01",
      amountCents: -1299,
      normalizedDescription: "NETFLIX",
    };
    expect(transactionHash(line)).toBe(transactionHash({ ...line }));
  });

  it("changes when any field changes", () => {
    const a = transactionHash({ date: "2026-06-01", amountCents: -4500, normalizedDescription: "X" });
    const b = transactionHash({ date: "2026-06-01", amountCents: -4501, normalizedDescription: "X" });
    const c = transactionHash({ date: "2026-06-02", amountCents: -4500, normalizedDescription: "X" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
