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
  /**
   * This borrower's own assurance emprunteur, per month.
   *
   * Insurance is priced per person — age, health, quotité assurée — so on a
   * couple's mortgage the two premiums are routinely different, and one
   * borrower can be covered at 100% while the other is at 50%. It lives here
   * rather than on the asset because it is a fact about *this person on this
   * loan*, and because a single figure on the loan cannot say whose it is.
   *
   * Null means "not stated per borrower"; the loan's own
   * `insuranceMonthlyCents` is then the whole premium.
   */
  insuranceMonthlyCents: number | null;
}

export type NewAssetOwner = Omit<AssetOwnerRow, "id">;
