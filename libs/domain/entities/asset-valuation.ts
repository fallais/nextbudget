/** A dated snapshot of an asset's value, used to plot net worth over time. */
export interface AssetValuationRow {
  id: number;
  assetId: number;
  /** ISO yyyy-MM-dd. */
  date: string;
  valueCents: number;
}

export type NewAssetValuation = Omit<AssetValuationRow, "id">;
