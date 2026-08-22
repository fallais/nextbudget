/**
 * Address → coordinates, via the Base Adresse Nationale.
 *
 * Free, keyless, and run by the state, which is what makes it usable from a
 * self-hosted app: nothing to sign up for, nothing to put in an env file. The
 * one thing it costs is that an address leaves the machine, so it is only ever
 * called when someone asks for an estimate — never on a page load.
 */

const BAN_SEARCH = "https://api-adresse.data.gouv.fr/search/";
const TIMEOUT_MS = 10_000;

/** Below this the geocoder is guessing, and a guess puts the house elsewhere. */
const MIN_SCORE = 0.4;

export type GeocodedAddress = {
  /** The address as the BAN understands it — worth showing back. */
  label: string;
  latitude: number;
  longitude: number;
  /** INSEE code of the commune, which is how DVF is filed. */
  cityCode: string;
  /** The folder DVF puts that commune in: "31", "2A", "974". */
  departmentCode: string;
};

type BanFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { label?: string; citycode?: string; score?: number };
};

/** Overseas codes are three digits; Corsica is "2A"/"2B"; everywhere else two. */
export function departmentOf(cityCode: string): string {
  return /^9[78]/.test(cityCode) ? cityCode.slice(0, 3) : cityCode.slice(0, 2);
}

export async function geocode(address: string): Promise<GeocodedAddress | null> {
  const query = address.trim();
  if (query.length < 3) return null;

  const url = `${BAN_SEARCH}?q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;

  const body = (await res.json()) as { features?: BanFeature[] };
  const feature = body.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  const cityCode = feature?.properties?.citycode;
  if (!coordinates || !cityCode) return null;
  if ((feature.properties?.score ?? 0) < MIN_SCORE) return null;

  const [longitude, latitude] = coordinates;
  return {
    label: feature.properties?.label ?? query,
    latitude,
    longitude,
    cityCode,
    departmentCode: departmentOf(cityCode),
  };
}
