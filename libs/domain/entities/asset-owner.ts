/**
 * One person's stake in one asset, as stored.
 *
 * The interesting rules live on `Ownership` in
 * `@domain/value-objects/share`: a share only makes sense as part of a set
 * that totals 100%, so validating a single row in isolation would be
 * meaningless.
 */
export interface AssetOwnerRow {
  id: number;
  assetId: number;
  personId: number;
  shareBps: number;
}

export type NewAssetOwner = Omit<AssetOwnerRow, "id">;
