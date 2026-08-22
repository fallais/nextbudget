import type { Asset, AssetRow, NewAsset } from "@domain/entities";
import type { OwnerShareRow } from "@domain/value-objects/share";
import type { Prepayment, PrepaymentRow, NewPrepayment } from "@domain/entities";
import type { Repository } from "./repository";

/**
 * A borrower's place in a loan: how much of it is theirs, and what their own
 * assurance emprunteur costs.
 *
 * The insurance rides alongside `OwnerShareRow` rather than inside it because
 * `Ownership` validates that shares total 100% — a premium is not part of that
 * rule and would only muddy a value object that exists to enforce it.
 */
export type AssetOwnerInput = OwnerShareRow & {
  insuranceMonthlyCents?: number | null;
};

/**
 * Asset is an aggregate root, and its ownership shares are inside the boundary:
 * the "shares total 100%" invariant is a property of the *set*, so the set can
 * only be written together with the asset it belongs to. That is why there is
 * no `assetOwners` repository to reach past this one.
 *
 * The write methods are therefore atomic by contract — an asset saved with a
 * half-written ownership split would be an asset whose invariant is false.
 */
export interface AssetRepository extends Repository<Asset, AssetRow, NewAsset> {
  /** `owners` omitted leaves the asset wholly owned by `ownerId` (the legacy read). */
  createWithOwners(input: NewAsset, owners?: AssetOwnerInput[]): Promise<Asset>;

  /** Resolves `null` when no asset has that id. */
  updateWithOwners(
    id: number,
    patch: Partial<NewAsset>,
    owners?: AssetOwnerInput[],
  ): Promise<Asset | null>;

  /**
   * Delete an asset and everything hanging off it: valuations and ownership
   * rows go with it, while fixed-expense and asset↔liability links are merely
   * cleared — those rows outlive the asset they pointed at.
   */
  deleteWithDependents(id: number): Promise<boolean>;

  /** Capital repaid ahead of schedule, oldest first. */
  listPrepayments(assetIds: number[]): Promise<Map<number, PrepaymentRow[]>>;
  addPrepayment(input: NewPrepayment): Promise<Prepayment>;
  /** Resolves `false` when no prepayment has that id on that loan. */
  deletePrepayment(assetId: number, prepaymentId: number): Promise<boolean>;

  /** Append valuation snapshots (the net-worth-over-time series). */
  recordValuations(
    entries: { assetId: number; date: string; valueCents: number }[],
  ): Promise<void>;
}
