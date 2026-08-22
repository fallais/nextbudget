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

/**
 * House or flat — the one distinction a valuation cannot do without.
 *
 * `real_estate` covers both, and nothing else in the app needs to tell them
 * apart. A price per m² does: the two trade at different rates in the same
 * street, so estimating a flat against houses is not an approximation, it is
 * the wrong market.
 */
export const PROPERTY_KINDS = ["maison", "appartement"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  maison: "Maison",
  appartement: "Appartement",
};
