import "server-only";
import { assets as assetRepo } from "@infrastructure/persistence/repositories";
import { getCurrentUser } from "./auth";
import { Ownership } from "@domain/value-objects/share";
import type { AssetRepository } from "@domain/repositories";
import type { AssetRow, NewAsset, PrepaymentRow } from "@domain/entities";
import type { z } from "zod";
import type { assetInputSchema, prepaymentInputSchema } from "./contracts/validation";
import { listAssets } from "@infrastructure/persistence/queries/assets";

/**
 * Patrimoine: the writes, plus the read models re-exported.
 */
export * from "@infrastructure/persistence/queries/assets";

export type AssetWriteDeps = {
  assets: Pick<
    AssetRepository,
    | "findById"
    | "createWithOwners"
    | "updateWithOwners"
    | "deleteWithDependents"
    | "addPrepayment"
    | "deletePrepayment"
    | "recordValuations"
  >;
  currentUserId: () => Promise<number | null>;
};

const LIVE_WRITE: AssetWriteDeps = {
  assets: assetRepo,
  currentUserId: async () => (await getCurrentUser())?.id ?? null,
};

export type AssetInput = z.infer<typeof assetInputSchema>;
export type PrepaymentInput = z.infer<typeof prepaymentInputSchema>;

/**
 * Record something owned or owed, with who owns what of it.
 *
 * `Ownership.fromRows` is the guard: a split that does not total 100% cannot
 * be constructed, so an invalid one never reaches the database. It throws a
 * DomainError, which the edge maps to a 400.
 */
export async function createAsset(
  input: AssetInput,
  deps: AssetWriteDeps = LIVE_WRITE,
): Promise<AssetRow> {
  const { owners, ...assetData } = input;
  if (owners) Ownership.fromRows(owners);

  const created = await deps.assets.createWithOwners(
    { ...assetData, ownerId: await deps.currentUserId(), visibility: "shared" } as NewAsset,
    owners,
  );
  return created.toRow();
}

/** Resolves `null` when no asset has that id. */
export async function updateAsset(
  assetId: number,
  patch: Partial<AssetInput>,
  deps: AssetWriteDeps = LIVE_WRITE,
): Promise<AssetRow | null> {
  const { owners, ...assetData } = patch;
  if (owners) Ownership.fromRows(owners);

  const updated = await deps.assets.updateWithOwners(assetId, assetData, owners);
  return updated?.toRow() ?? null;
}

/** Resolves `false` when there was nothing to delete. */
export async function deleteAsset(
  assetId: number,
  deps: AssetWriteDeps = LIVE_WRITE,
): Promise<boolean> {
  return deps.assets.deleteWithDependents(assetId);
}

/** Resolves `null` when the loan does not exist. */
export async function addPrepayment(
  assetId: number,
  input: PrepaymentInput,
  deps: AssetWriteDeps = LIVE_WRITE,
): Promise<PrepaymentRow | null> {
  const asset = await deps.assets.findById(assetId);
  if (!asset) return null;

  const created = await deps.assets.addPrepayment({
    assetId,
    date: input.date,
    amountCents: input.amountCents,
    mode: input.mode,
    feesCents: input.feesCents ?? null,
    notes: input.notes ?? null,
  });
  return created.toRow();
}

/** Resolves `false` when that loan has no prepayment with that id. */
export async function deletePrepayment(
  assetId: number,
  prepaymentId: number,
  deps: AssetWriteDeps = LIVE_WRITE,
): Promise<boolean> {
  return deps.assets.deletePrepayment(assetId, prepaymentId);
}

/**
 * Stamp today's value of everything still held.
 *
 * Inactive assets are left out on purpose: a sold house should stop appearing
 * in the net-worth series from the day it went, not carry its last known price
 * forward for ever.
 */
export async function recordSnapshot(
  now: Date = new Date(),
  deps: AssetWriteDeps = LIVE_WRITE,
): Promise<number> {
  const active = (await listAssets()).filter((a) => a.isActive);
  const date = now.toISOString().slice(0, 10);
  await deps.assets.recordValuations(
    active.map((a) => ({ assetId: a.id, date, valueCents: a.valueCents })),
  );
  return active.length;
}
