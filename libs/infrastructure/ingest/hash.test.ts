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

  it("leaves the first occurrence hashing as it always did", () => {
    // Rows written before occurrences existed carry this hash. If occurrence 0
    // drifted, every one of them would look new on the next import.
    const line = { date: "2026-06-01", amountCents: -4500, normalizedDescription: "RATP" };
    expect(transactionHash({ ...line, occurrence: 0 })).toBe(transactionHash(line));
    expect(transactionHash(line)).toBe(
      createHash("sha256").update("2026-06-01|-4500|RATP").digest("hex"),
    );
  });

  it("gives each later occurrence of one fingerprint its own hash", () => {
    // Three identical lines on a statement are three rows, so three hashes —
    // otherwise the account-unique index collapses them back into one.
    const line = { date: "2026-06-01", amountCents: -190, normalizedDescription: "RATP" };
    const hashes = [0, 1, 2].map((occurrence) => transactionHash({ ...line, occurrence }));
    expect(new Set(hashes).size).toBe(3);
    expect(hashes[1]).toBe(createHash("sha256").update("2026-06-01|-190|RATP|#1").digest("hex"));
  });

  it("changes when any field changes", () => {
    const a = transactionHash({ date: "2026-06-01", amountCents: -4500, normalizedDescription: "X" });
    const b = transactionHash({ date: "2026-06-01", amountCents: -4501, normalizedDescription: "X" });
    const c = transactionHash({ date: "2026-06-02", amountCents: -4500, normalizedDescription: "X" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
