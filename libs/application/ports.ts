import type { GeocodedAddress } from "@infrastructure/estimation/geocode";
import type { CommuneMarket } from "@infrastructure/estimation/dvf";
import type { PropertyKind } from "@domain/enums";

/**
 * What the use cases need from the outside world, other than storage.
 *
 * Storage ports live in `@domain/repositories`, because a repository hands
 * back entities and the domain is the thing that defines those. These do not:
 * a geocoder and an open-data host are the application's own business, so the
 * interfaces belong here, next to the use cases that name them.
 *
 * The point of writing them down is substitution. A use case that reaches for
 * `@infrastructure` by name can only ever be exercised against the real thing,
 * which for this pair means a use case nobody can test without asking the
 * French state for an address.
 */

/** An address to a point on the map, or null when it cannot be placed. */
export type Geocoder = (address: string) => Promise<GeocodedAddress | null>;

/** Recorded sales for a commune, and what its bare ground goes for. */
export type ComparableSource = (
  departmentCode: string,
  cityCode: string,
  kind: PropertyKind,
  now: Date,
) => Promise<CommuneMarket>;
