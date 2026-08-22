/**
 * What a property is worth, from what nearby ones actually sold for.
 *
 * DVF is the register of recorded sale prices — the same public data the
 * estimation sites are built on. Having it means the arithmetic can live here,
 * in the domain, with the network kept out at the edge: this file is given
 * sales and returns a figure, so it can be tested without asking the
 * government anything.
 *
 * The method is deliberately the dull one. Take sales of the same kind of
 * property, near enough and recent enough to mean something, of a comparable
 * size; take the **median** price per m² and multiply by the surface. A median
 * because one château among twenty houses moves a mean and does not move a
 * median, and DVF is full of them. Quartiles come back with it, because a
 * single number would claim a precision this does not have.
 */

export type Comparable = {
  /** `valeur_fonciere` for the sale, in cents. */
  valueCents: number;
  /** `surface_reelle_bati`, m². */
  surfaceM2: number;
  /** `date_mutation`, ISO. */
  date: string;
  latitude: number;
  longitude: number;
};

export type Subject = {
  surfaceM2: number;
  latitude: number;
  longitude: number;
};

export type Estimate = {
  /** Median price/m² × the subject's surface. */
  valueCents: number;
  pricePerM2Cents: number;
  /** The interquartile range, carried through to the estimate. */
  lowCents: number;
  highCents: number;
  sampleSize: number;
  radiusM: number;
  oldestDate: string;
  newestDate: string;
};

/** Below this a median is an anecdote, not a market. */
export const MIN_SAMPLE = 5;

/**
 * How far a comparable's surface may be from the subject's.
 *
 * Price per m² is not flat across sizes — a 30 m² studio and a 300 m² house do
 * not trade at the same rate — so comparing like with like matters more than
 * having more points.
 */
const SURFACE_TOLERANCE = 0.3;

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** The value at `q` through a sorted list, interpolating between neighbours. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

/**
 * Estimate `subject` from `comparables`, or `null` when too few of them are
 * close enough to say anything. Widening the radius is the caller's decision:
 * it is the one that knows whether a bigger circle still means the same
 * market.
 */
export function estimate(
  subject: Subject,
  comparables: Comparable[],
  radiusM: number,
): Estimate | null {
  if (subject.surfaceM2 <= 0) return null;

  const minSurface = subject.surfaceM2 * (1 - SURFACE_TOLERANCE);
  const maxSurface = subject.surfaceM2 * (1 + SURFACE_TOLERANCE);

  const kept = comparables.filter(
    (c) =>
      c.surfaceM2 >= minSurface &&
      c.surfaceM2 <= maxSurface &&
      c.surfaceM2 > 0 &&
      c.valueCents > 0 &&
      distanceMetres(subject, c) <= radiusM,
  );
  if (kept.length < MIN_SAMPLE) return null;

  const perM2 = kept.map((c) => c.valueCents / c.surfaceM2).sort((a, b) => a - b);
  const median = quantile(perM2, 0.5);
  const dates = kept.map((c) => c.date).sort();

  return {
    valueCents: Math.round(median * subject.surfaceM2),
    pricePerM2Cents: Math.round(median),
    lowCents: Math.round(quantile(perM2, 0.25) * subject.surfaceM2),
    highCents: Math.round(quantile(perM2, 0.75) * subject.surfaceM2),
    sampleSize: kept.length,
    radiusM,
    oldestDate: dates[0],
    newestDate: dates[dates.length - 1],
  };
}
