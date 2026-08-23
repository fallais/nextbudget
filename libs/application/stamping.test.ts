import { describe, it, expect } from "vitest";
import { createCategory, type CategoryDeps } from "./categories";
import { createRule, type RuleDeps } from "./rules";
import { createContribution, type ContributionDeps } from "./contributions";
import { Category, Rule, Contribution } from "@domain/entities";
import type { NewCategory, NewRule, NewContribution } from "@domain/entities";

/**
 * The decisions that used to live in route handlers.
 *
 * Each of these is a default the client never sends and must not be able to
 * choose: who owns a row, whether it is shared, whether it is one of the
 * categories `db:migrate` seeds. They were single lines inside a POST handler,
 * where nothing could reach them; this is the point of having moved them.
 */

const captured = <T,>() => {
  const box: { value: T | null } = { value: null };
  return box;
};

describe("createCategory", () => {
  it("never lets a user create a default category", async () => {
    // `isDefault` marks the ones seeded on install and is what stops them
    // being deleted out from under a fresh database. Accepting it from a
    // request body would let anyone mint an undeletable category.
    const box = captured<NewCategory>();
    const deps = {
      categories: {
        create: async (input: NewCategory) => {
          box.value = input;
          return Category.create(input);
        },
      },
    } as unknown as CategoryDeps;

    await createCategory(
      { name: "Courses", color: "#16a34a", icon: "ShoppingCart", isDefault: true } as never,
      deps,
    );
    expect(box.value!.isDefault).toBe(false);
  });
});

describe("createRule", () => {
  const deps = (box: { value: NewRule | null }, me: number | null) =>
    ({
      rules: {
        create: async (input: NewRule) => {
          box.value = input;
          return Rule.create(input);
        },
      },
      transactions: {},
      currentUserId: async () => me,
    }) as unknown as RuleDeps;

  const input = {
    categoryId: 1,
    pattern: "CARREFOUR",
    matchType: "contains",
    amountCondition: "any",
    priority: 50,
    isActive: true,
  } as never;

  it("is always shared, never private", async () => {
    // Rules are configuration for how a statement is read, and the scope
    // helpers deliberately never filter them. A private rule would categorise
    // one person's view of a joint account and not the other's.
    const box = captured<NewRule>();
    await createRule(input, deps(box, 7));
    expect(box.value!.visibility).toBe("shared");
  });

  it("is stamped with whoever wrote it", async () => {
    const box = captured<NewRule>();
    await createRule(input, deps(box, 7));
    expect(box.value!.ownerId).toBe(7);
  });

  it("is left unowned in open mode", async () => {
    const box = captured<NewRule>();
    await createRule(input, deps(box, null));
    expect(box.value!.ownerId).toBeNull();
  });
});

describe("createContribution", () => {
  it("is shared and stamped, an apport being a household fact", async () => {
    // Hiding it from the person it is matched against would make the
    // reconciliation screen unreadable.
    const box = captured<NewContribution>();
    const deps = {
      contributions: {
        create: async (input: NewContribution) => {
          box.value = input;
          return Contribution.create(input);
        },
      },
      currentUserId: async () => 3,
    } as unknown as ContributionDeps;

    await createContribution(
      {
        personId: 1,
        name: "Virement Alex",
        expectedAmountCents: 100_000,
        matchPattern: "VIREMENT ALEX",
        matchType: "contains",
        tolerancePct: 5,
        isActive: true,
      } as never,
      deps,
    );
    expect(box.value!.visibility).toBe("shared");
    expect(box.value!.ownerId).toBe(3);
  });
});
