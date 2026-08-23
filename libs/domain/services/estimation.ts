import type { PropertyCondition } from "@domain/enums";

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
 *
 * Two adjustments sit on top of that figure, and they are not the same kind of
 * thing. The plot is measured and fitted (`fitLandWeight`). The condition is
 * declared by the owner and applied at a conventional rate, because no open
 * data records it.
 */

export type Comparable = {
  /** `valeur_fonciere` for the sale, in cents. */
  valueCents: number;
  /** `surface_reelle_bati`, m². */
  surfaceM2: number;
  /** The parcels that were the property's own ground, m². 0 when it had none. */
  landM2: number;
  /** `date_mutation`, ISO. */
  date: string;
  latitude: number;
  longitude: number;
};

export type Subject = {
  surfaceM2: number;
  /** Null when the owner has not recorded the plot, which disables the adjustment. */
  landM2: number | null;
  latitude: number;
  longitude: number;
  /** Null when the owner has not said, which disables the adjustment. */
  condition: PropertyCondition | null;
};

export type Estimate = {
  /** What the comps said, adjusted for the plot and the declared condition. */
  valueCents: number;
  /** `valueCents` over the built surface, so the two always agree. */
  pricePerM2Cents: number;
  /** The interquartile range, carried through to the estimate. */
  lowCents: number;
  highCents: number;
  sampleSize: number;
  radiusM: number;
  oldestDate: string;
  newestDate: string;
  /** Median price/m² × the subject's surface, before either adjustment. */
  marketCents: number;
  /** What the plot differing from the comps' is worth. 0 when not applied. */
  landAdjustmentCents: number;
  /** The comps' median plot, which is what that difference is measured from. */
  comparableLandM2: number | null;
  /** What the declared condition is worth. 0 when not applied. */
  conditionAdjustmentCents: number;
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

/**
 * What each declared condition does to the figure, in basis points.
 *
 * These are convention, and they are the one part of this file no backtest can
 * defend: DVF records no condition, so there is nothing to fit them against.
 * They follow the discount a valuer applies out of habit, and `bon` is zero
 * because the median comparable already is a house in ordinary condition.
 *
 * Anyone who disagrees with a number here should change it. That is a
 * different act from disagreeing with the market figure, which is measured.
 */
const CONDITION_BPS: Record<PropertyCondition, number> = {
  a_renover: -2000,
  a_rafraichir: -800,
  bon: 0,
  refait: 500,
  neuf: 1000,
};

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

/** The sales close enough, and near enough in size, to speak for `subject`. */
function select(
  subject: { surfaceM2: number; latitude: number; longitude: number },
  comparables: Comparable[],
  radiusM: number,
  exclude?: Comparable,
): Comparable[] {
  const minSurface = subject.surfaceM2 * (1 - SURFACE_TOLERANCE);
  const maxSurface = subject.surfaceM2 * (1 + SURFACE_TOLERANCE);
  return comparables.filter(
    (c) =>
      c !== exclude &&
      c.surfaceM2 >= minSurface &&
      c.surfaceM2 <= maxSurface &&
      c.surfaceM2 > 0 &&
      c.valueCents > 0 &&
      distanceMetres(subject, c) <= radiusM,
  );
}

/** The first circle in `radiiM` holding enough sales, as `estimate` picks it. */
function selectByLadder(
  subject: { surfaceM2: number; latitude: number; longitude: number },
  comparables: Comparable[],
  radiiM: number[],
  exclude?: Comparable,
): Comparable[] | null {
  for (const radiusM of radiiM) {
    const kept = select(subject, comparables, radiusM, exclude);
    if (kept.length >= MIN_SAMPLE) return kept;
  }
  return null;
}

/**
 * How much a plot bigger or smaller than the neighbours' is worth here.
 *
 * `rateCents` is what bare ground sells for, and applying it whole is wrong:
 * a constructible plot is not the garden of a house that already stands on it.
 * How much of it carries over is a local fact, not a constant. Where land is
 * expensive and every plot is the same size — Rennes, Angers — plot size
 * explains nothing and the honest weight is zero. Where land is cheap and
 * plots run from 400 m² to five hectares — Plouguerneau — it explains a great
 * deal.
 *
 * So it is fitted rather than assumed, against the commune's own sales: each
 * one is estimated from the others at every candidate weight, and the weight
 * with the smallest median error wins.
 *
 * Winning is not enough to be adopted. On a sample of a few hundred sales the
 * best weight is often the noise, and picking it costs more than it pays —
 * across five splits of seven communes, an argmin taken at face value handed
 * Guérande 3.8 points of extra error. A weight has to beat doing nothing by
 * `ADOPTION_MARGIN` before it is believed, and anything less returns null, so a
 * commune where the plot says nothing computes exactly what it computed before
 * this existed.
 *
 * With that rule the adjustment fired in 7 of 35 commune-splits and improved
 * every one of them, by 0.4 to 6.0 points of median error, the largest in
 * Plouguerneau where plots run from 400 m² to five hectares. Nothing in the
 * sample was made worse.
 */
export type LandModel = {
  /** Median €/m² of bare ground in the commune, cents. */
  rateCents: number;
  /** The share of it a difference in plot size is worth. */
  weight: number;
};

const LAND_WEIGHTS = [0, 0.15, 0.3, 0.5, 0.75, 1];

/** How much better than nothing a weight must be before it is believed. */
const ADOPTION_MARGIN = 0.05;

/** Fitting on fewer sales than this is fitting to noise. */
const MIN_FIT_SUBJECTS = 30;

/**
 * Enough to fit on, and few enough that the fit stays quick.
 *
 * Every candidate is scored against the whole set, so the work is the product
 * of the two, and the set is every flat in Paris for someone who owns one.
 */
const MAX_FIT_SUBJECTS = 300;

export function fitLandWeight(
  comparables: Comparable[],
  rateCents: number | null,
  radiiM: number[],
): LandModel | null {
  if (rateCents === null || rateCents <= 0) return null;

  // Sorted before it is thinned, so which sales end up in the sample is a fact
  // about the commune rather than about the order the years were fetched in.
  // Sampling half of Colomiers one way rather than the other was enough to
  // move the fitted weight from nothing to 0.5.
  const withLand = comparables
    .filter((c) => c.landM2 > 0)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.valueCents - b.valueCents ||
        a.surfaceM2 - b.surfaceM2 ||
        a.latitude - b.latitude ||
        a.longitude - b.longitude,
    );
  const stride = Math.max(1, Math.ceil(withLand.length / MAX_FIT_SUBJECTS));
  const subjects = withLand.filter((_, i) => i % stride === 0);

  // Comp selection does not depend on the weight, so it is done once and every
  // candidate is scored against the same sets.
  const cases: { actual: number; base: number; landM2: number; comparableLandM2: number }[] = [];
  for (const subject of subjects) {
    const kept = selectByLadder(subject, comparables, radiiM, subject);
    if (!kept) continue;
    const perM2 = kept.map((c) => c.valueCents / c.surfaceM2).sort((a, b) => a - b);
    const lands = kept.map((c) => c.landM2).sort((a, b) => a - b);
    cases.push({
      actual: subject.valueCents,
      base: quantile(perM2, 0.5) * subject.surfaceM2,
      landM2: subject.landM2,
      comparableLandM2: quantile(lands, 0.5),
    });
  }
  if (cases.length < MIN_FIT_SUBJECTS) return null;

  const errorAt = (weight: number) => {
    const errors = cases
      .map((c) => {
        const adjusted = c.base + weight * rateCents * (c.landM2 - c.comparableLandM2);
        return Math.abs((adjusted > 0 ? adjusted : c.base) - c.actual) / c.actual;
      })
      .sort((a, b) => a - b);
    return quantile(errors, 0.5);
  };

  let best = { weight: 0, error: Number.POSITIVE_INFINITY };
  for (const weight of LAND_WEIGHTS) {
    const error = errorAt(weight);
    if (error < best.error) best = { weight, error };
  }
  const doNothing = errorAt(0);
  const worthIt = best.weight > 0 && best.error <= doNothing * (1 - ADOPTION_MARGIN);
  return worthIt ? { rateCents, weight: best.weight } : null;
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
  land: LandModel | null = null,
): Estimate | null {
  if (subject.surfaceM2 <= 0) return null;

  const kept = select(subject, comparables, radiusM);
  if (kept.length < MIN_SAMPLE) return null;

  const perM2 = kept.map((c) => c.valueCents / c.surfaceM2).sort((a, b) => a - b);
  const dates = kept.map((c) => c.date).sort();
  const marketCents = Math.round(quantile(perM2, 0.5) * subject.surfaceM2);

  let comparableLandM2: number | null = null;
  let landAdjustmentCents = 0;
  if (land && subject.landM2 !== null && subject.landM2 >= 0) {
    const lands = kept.map((c) => c.landM2).sort((a, b) => a - b);
    const median = quantile(lands, 0.5);
    comparableLandM2 = Math.round(median);
    landAdjustmentCents = Math.round(land.weight * land.rateCents * (subject.landM2 - median));
    // A plot small enough to wipe out the house is the adjustment failing, not
    // the house being worthless.
    if (marketCents + landAdjustmentCents <= 0) landAdjustmentCents = 0;
  }

  const beforeCondition = marketCents + landAdjustmentCents;
  const conditionAdjustmentCents = subject.condition
    ? Math.round((beforeCondition * CONDITION_BPS[subject.condition]) / 10_000)
    : 0;
  const shift = landAdjustmentCents + conditionAdjustmentCents;
  const valueCents = beforeCondition + conditionAdjustmentCents;

  return {
    valueCents,
    pricePerM2Cents: Math.round(valueCents / subject.surfaceM2),
    lowCents: Math.round(quantile(perM2, 0.25) * subject.surfaceM2) + shift,
    highCents: Math.round(quantile(perM2, 0.75) * subject.surfaceM2) + shift,
    sampleSize: kept.length,
    radiusM,
    oldestDate: dates[0],
    newestDate: dates[dates.length - 1],
    marketCents,
    landAdjustmentCents,
    comparableLandM2,
    conditionAdjustmentCents,
  };
}
