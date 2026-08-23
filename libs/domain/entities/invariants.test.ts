import { describe, it, expect } from "vitest";
import { DomainError } from "@domain/errors";
import { Category } from "./category";
import { Contribution } from "./contribution";
import { FixedExpense } from "./fixed-expense";
import { Person } from "./person";
import { Rule } from "./rule";
import { Transaction } from "./transaction";
import { Prepayment } from "./prepayment";

/**
 * What each entity refuses to be built as.
 *
 * `create()` is the only way user input becomes a row, so these are the rules
 * standing between a form and the database — there are no CHECK constraints
 * behind them. Each one is asserted to throw a DomainError specifically,
 * because that is what the HTTP edge maps to a 400 with the French message;
 * anything else surfaces as a 500 and a stack trace.
 */

const refuses = (fn: () => unknown) => expect(fn).toThrow(DomainError);

describe("Category", () => {
  const ok = { name: "Courses", color: "#16a34a", icon: "ShoppingCart", isDefault: false };

  it("needs a name that is more than whitespace", () => {
    refuses(() => Category.create({ ...ok, name: "" }));
    refuses(() => Category.create({ ...ok, name: "   " }));
  });

  it("needs a colour the UI can actually paint with", () => {
    // It ends up in a style attribute and in the chart palette.
    refuses(() => Category.create({ ...ok, color: "green" }));
    refuses(() => Category.create({ ...ok, color: "#xyzxyz" }));
    refuses(() => Category.create({ ...ok, color: "16a34a" }));
    expect(Category.create({ ...ok, color: "#16a34a" }).toRow().color).toBe("#16a34a");
  });
});

describe("Rule", () => {
  const ok = {
    categoryId: 1,
    pattern: "CARREFOUR",
    matchType: "contains" as const,
    amountCondition: "any" as const,
    priority: 50,
    isActive: true,
    ownerId: null,
    visibility: "shared" as const,
  };

  it("needs a pattern", () => {
    refuses(() => Rule.create({ ...ok, pattern: "  " }));
  });

  it("refuses a regex that will not compile", () => {
    // Otherwise it throws on every categorisation run afterwards, far from
    // the form that accepted it.
    refuses(() => Rule.create({ ...ok, matchType: "regex", pattern: "[unclosed" }));
    refuses(() => Rule.create({ ...ok, matchType: "regex", pattern: "*" }));
  });

  it("does not try to compile a pattern that is not a regex", () => {
    // "[unclosed" is a perfectly good literal to search for.
    expect(() => Rule.create({ ...ok, matchType: "contains", pattern: "[unclosed" })).not.toThrow();
  });
});

describe("Transaction", () => {
  const ok = {
    accountId: 1,
    categoryId: null,
    date: "2026-05-15",
    description: "CARREFOUR",
    normalizedDescription: "carrefour",
    amountCents: -1250,
    currency: "EUR",
    hash: "abc123",
    sourceFile: null,
    raw: null,
  };

  it("needs an ISO date, not whatever the file happened to contain", () => {
    refuses(() => Transaction.create({ ...ok, date: "15/05/2026" }));
    refuses(() => Transaction.create({ ...ok, date: "2026-5-15" }));
    refuses(() => Transaction.create({ ...ok, date: "" }));
  });

  it("needs the dedup fingerprint", () => {
    // Without it the next import of the same statement writes everything twice.
    refuses(() => Transaction.create({ ...ok, hash: "" }));
  });

  it("takes a negative amount, an expense being the normal case", () => {
    expect(Transaction.create(ok).toRow().amountCents).toBe(-1250);
    expect(Transaction.create({ ...ok, amountCents: 1250 }).toRow().amountCents).toBe(1250);
  });

  it("refuses an amount that is not a whole number of cents", () => {
    refuses(() => Transaction.create({ ...ok, amountCents: 12.5 }));
  });
});

describe("Person", () => {
  const ok = {
    name: "Alex",
    userId: null,
    monthlySalaryCents: null,
    matchPattern: null,
    matchType: "contains" as const,
    tolerancePct: 10,
    isActive: true,
  };

  it("needs a name", () => {
    refuses(() => Person.create({ ...ok, name: " " }));
  });

  it("keeps tolerance a percentage", () => {
    refuses(() => Person.create({ ...ok, tolerancePct: -1 }));
    refuses(() => Person.create({ ...ok, tolerancePct: 101 }));
    expect(Person.create({ ...ok, tolerancePct: 0 }).toRow().tolerancePct).toBe(0);
    expect(Person.create({ ...ok, tolerancePct: 100 }).toRow().tolerancePct).toBe(100);
  });
});

describe("Contribution", () => {
  const ok = {
    personId: 1,
    name: "Virement Alex",
    expectedAmountCents: 100_000,
    matchPattern: "VIREMENT ALEX",
    matchType: "contains" as const,
    tolerancePct: 5,
    isActive: true,
    notes: null,
    ownerId: null,
    visibility: "shared" as const,
  };

  it("needs a name and something to match on", () => {
    refuses(() => Contribution.create({ ...ok, name: "" }));
    refuses(() => Contribution.create({ ...ok, matchPattern: "  " }));
  });

  it("keeps tolerance a percentage", () => {
    refuses(() => Contribution.create({ ...ok, tolerancePct: 150 }));
  });
});

describe("FixedExpense", () => {
  const ok = {
    name: "Électricité",
    categoryId: 1,
    liabilityId: null,
    expectedAmountCents: 8000,
    tolerancePct: 10,
    dueDay: 5,
    matchPattern: "EDF",
    matchType: "contains" as const,
    isActive: true,
    notes: null,
    ownerId: null,
    visibility: "shared" as const,
  };

  it("needs a name and something to match on", () => {
    refuses(() => FixedExpense.create({ ...ok, name: "" }));
    refuses(() => FixedExpense.create({ ...ok, matchPattern: "" }));
  });

  it("keeps the due day inside a month", () => {
    refuses(() => FixedExpense.create({ ...ok, dueDay: 0 }));
    refuses(() => FixedExpense.create({ ...ok, dueDay: 32 }));
    // 31 is allowed even though not every month has one: the status logic
    // clamps it rather than the entity refusing a legitimate direct debit.
    expect(FixedExpense.create({ ...ok, dueDay: 31 }).toRow().dueDay).toBe(31);
  });
});

describe("Prepayment", () => {
  const ok = {
    assetId: 1,
    date: "2026-05-15",
    amountCents: 500_000,
    mode: "duration" as const,
    feesCents: null,
    notes: null,
  };

  it("needs a real amount: a prepayment of nothing rebuilds a schedule for nothing", () => {
    refuses(() => Prepayment.create({ ...ok, amountCents: 0 }));
    refuses(() => Prepayment.create({ ...ok, amountCents: -1 }));
  });

  it("needs a date, since the whole schedule is rebuilt around it", () => {
    refuses(() => Prepayment.create({ ...ok, date: "" }));
    refuses(() => Prepayment.create({ ...ok, date: "15/05/2026" }));
  });
});
