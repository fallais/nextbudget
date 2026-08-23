import "server-only";
import { contributions } from "@infrastructure/persistence/repositories";
import { getCurrentUser } from "./auth";
import type { ContributionRow } from "@domain/entities";
import type { ContributionRepository } from "@domain/repositories";
import type { z } from "zod";
import type { contributionInputSchema } from "./contracts/validation";

/**
 * Apports: the writes, plus the read models re-exported.
 */
export * from "@infrastructure/persistence/queries/contributions";

export type ContributionDeps = {
  contributions: Pick<ContributionRepository, "create" | "update" | "delete">;
  currentUserId: () => Promise<number | null>;
};

const LIVE: ContributionDeps = {
  contributions,
  currentUserId: async () => (await getCurrentUser())?.id ?? null,
};

export type ContributionInput = z.infer<typeof contributionInputSchema>;

/**
 * Record what somebody puts into the joint account.
 *
 * Stamped with its creator and shared by default: an apport is a household
 * fact, not a private one, and hiding it from the person it is matched against
 * would make the reconciliation unreadable.
 */
export async function createContribution(
  input: ContributionInput,
  deps: ContributionDeps = LIVE,
): Promise<ContributionRow> {
  const created = await deps.contributions.create({
    ownerId: await deps.currentUserId(),
    visibility: "shared",
    personId: input.personId,
    name: input.name,
    expectedAmountCents: input.expectedAmountCents,
    matchPattern: input.matchPattern,
    matchType: input.matchType,
    tolerancePct: input.tolerancePct,
    isActive: input.isActive,
    notes: input.notes ?? null,
  });
  return created.toRow();
}

/** Resolves `null` when no contribution has that id. */
export async function updateContribution(
  contributionId: number,
  patch: Partial<ContributionInput>,
  deps: ContributionDeps = LIVE,
): Promise<ContributionRow | null> {
  const updated = await deps.contributions.update(contributionId, patch);
  return updated?.toRow() ?? null;
}

/** Resolves `false` when there was nothing to delete. */
export async function deleteContribution(
  contributionId: number,
  deps: ContributionDeps = LIVE,
): Promise<boolean> {
  return deps.contributions.delete(contributionId);
}
