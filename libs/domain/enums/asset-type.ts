/** Something owned, or something owed. */
export const ASSET_KINDS = ["asset", "liability"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Types that make sense for something owned. */
export const ASSET_TYPES = [
  "real_estate",
  "vehicle",
  "savings",
  "investment",
  "other",
] as const;

/** Types that make sense for a debt — a house is never a liability type. */
export const LIABILITY_TYPES = ["mortgage", "loan", "other"] as const;

export type AssetType = (typeof ASSET_TYPES)[number] | (typeof LIABILITY_TYPES)[number];

export const ASSET_TYPE_VALUES = [
  ...ASSET_TYPES,
  ...LIABILITY_TYPES.filter((t) => !ASSET_TYPES.includes(t as never)),
] as AssetType[];

export function typesFor(kind: AssetKind): readonly AssetType[] {
  return kind === "asset" ? ASSET_TYPES : LIABILITY_TYPES;
}
