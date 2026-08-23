import Papa from "papaparse";
import type { Comparable } from "@domain/services/estimation";
import type { PropertyKind } from "@domain/enums";
import { PROPERTY_KINDS } from "@domain/enums";

/**
 * Recorded sale prices, from the DVF open data.
 *
 * Published as one CSV per commune per year — around 200 kB — so an estimate
 * fetches the few files covering one town rather than importing a national
 * dataset nobody asked to host. Nothing is stored: the files are read, the
 * median is taken, and they are dropped.
 *
 * https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/communes/{dept}/{insee}.csv
 */

const BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv";
const TIMEOUT_MS = 20_000;

/** How far back to look. Older sales say less about today's market. */
export const YEARS_BACK = 3;

/** How DVF spells the two kinds. Its vocabulary, so it stays in this file. */
const TYPE_LOCAL: Record<PropertyKind, string> = {
  maison: "Maison",
  appartement: "Appartement",
};

/**
 * The cadastral cultures that a house's own ground is made of.
 *
 * `S` sols, `J` jardins, `AB` terrains à bâtir, `AG` terrains d'agrément.
 * Everything else DVF can attach to a sale — terres, prés, bois, landes — is
 * farmland, and it trades two orders of magnitude cheaper per m²: around 2 €
 * against 260 € in Colomiers, 4 € against 850 € in Rennes. Counting a
 * smallholding's fields as garden would value them like building plots and put
 * a farmhouse in the millions, so only these four are treated as the plot.
 */
const RESIDENTIAL_CULTURES = new Set(["S", "J", "AB", "AG"]);

/**
 * Below this the commune has not sold enough bare ground to price any.
 *
 * Deliberately high. A rate drawn from ten plots is an anecdote, and it is
 * used to move a house's valuation: Le Vésinet's ten sales imply 1 597 €/m²,
 * which is the sort of number that turns a garden into a wing of the house.
 */
const MIN_LAND_SALES = 20;

/**
 * Below this a sale of land is paperwork, not a price.
 *
 * DVF records donations, boundary corrections between neighbours and transfers
 * within a family as `Vente` at one euro, and there are as many of them as
 * there are real plot sales: in Colomiers seventeen of each in 2024, which
 * drags the median rate from 330 €/m² down to almost nothing and quietly
 * switches the whole adjustment off.
 */
const MIN_LAND_SALE_CENTS = 1_000_00;

/** The columns this reads. DVF has forty; these are the ones that matter. */
export type DvfRow = {
  id_mutation: string;
  date_mutation: string;
  nature_mutation: string;
  valeur_fonciere: string;
  id_parcelle: string;
  type_local: string;
  surface_reelle_bati: string;
  code_nature_culture: string;
  surface_terrain: string;
  longitude: string;
  latitude: string;
};

function euros(raw: string): number | null {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function int(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function byMutation(rows: DvfRow[]): Map<string, DvfRow[]> {
  const groups = new Map<string, DvfRow[]>();
  for (const row of rows) {
    if (row.nature_mutation !== "Vente") continue;
    const group = groups.get(row.id_mutation);
    if (group) group.push(row);
    else groups.set(row.id_mutation, [row]);
  }
  return groups;
}

/**
 * The plot, in m², from the parcels a sale covered.
 *
 * A mutation lists one row per parcel per local, and repeats the parcel's area
 * on every one of them: a house with two outbuildings on one parcel carries the
 * same `surface_terrain` three times. Summing the column would treble it, so
 * parcels are counted once each.
 */
export function residentialLandM2(group: DvfRow[]): number {
  const areaByParcel = new Map<string, number>();
  for (const row of group) {
    if (!RESIDENTIAL_CULTURES.has(row.code_nature_culture)) continue;
    const area = int(row.surface_terrain);
    if (area === null || area <= 0) continue;
    areaByParcel.set(row.id_parcelle, area);
  }
  let total = 0;
  for (const area of areaByParcel.values()) total += area;
  return total;
}

/**
 * Sales of `kind` that can be priced per m².
 *
 * A mutation is one transaction and can span several rows: a house, its
 * garage, the parcel it sits on. There is a single `valeur_fonciere` for the
 * lot, so it can only be attributed to a surface when exactly one built
 * property was sold — two houses at one price, or a house sold with a flat,
 * price neither. Dependencies and bare parcels carry no surface and do not
 * interfere.
 */
export function toComparables(rows: DvfRow[], kind: PropertyKind): Comparable[] {
  const comparables: Comparable[] = [];
  for (const group of byMutation(rows).values()) {
    const built = group.filter((r) => r.type_local === "Maison" || r.type_local === "Appartement");
    if (built.length !== 1 || built[0].type_local !== TYPE_LOCAL[kind]) continue;

    const row = built[0];
    const valueCents = euros(row.valeur_fonciere);
    const surfaceM2 = int(row.surface_reelle_bati);
    const latitude = Number.parseFloat(row.latitude);
    const longitude = Number.parseFloat(row.longitude);
    if (valueCents === null || surfaceM2 === null || surfaceM2 <= 0) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    comparables.push({
      valueCents,
      surfaceM2,
      landM2: residentialLandM2(group),
      date: row.date_mutation,
      latitude,
      longitude,
    });
  }
  return comparables;
}

/**
 * What bare ground fetched per m², from the sales that were nothing but ground.
 *
 * A sale with no built local on it is a plot changing hands, and its price
 * divided by its area is the only direct reading of what land is worth in this
 * commune. Mixed sales are left out: any parcel of farmland in the lot and the
 * average stops describing either market.
 *
 * This is not what a garden is worth. A constructible plot sells for far more
 * per m² than the ground around an existing house, which is why the estimation
 * service fits how much of this rate actually applies rather than believing it.
 */
export function toLandPricesCents(rows: DvfRow[]): number[] {
  const prices: number[] = [];
  for (const group of byMutation(rows).values()) {
    if (group.some((r) => r.type_local)) continue;
    const hasOtherCulture = group.some(
      (r) => r.surface_terrain && !RESIDENTIAL_CULTURES.has(r.code_nature_culture),
    );
    if (hasOtherCulture) continue;

    const valueCents = euros(group[0].valeur_fonciere);
    const landM2 = residentialLandM2(group);
    if (valueCents === null || valueCents < MIN_LAND_SALE_CENTS || landM2 <= 0) continue;
    prices.push(valueCents / landM2);
  }
  return prices;
}

/** Every usable sale in a commune-year, plus what its bare ground went for. */
export type CommuneYear = {
  comparables: Record<PropertyKind, Comparable[]>;
  landPricesCents: number[];
};

// One commune-year is immutable once published, so a process that estimates
// the same house twice should not fetch it twice. Bounded by the number of
// communes anyone looks at, which for a household budget is one or two.
const cache = new Map<string, CommuneYear>();

async function fetchYear(
  departmentCode: string,
  cityCode: string,
  year: number,
): Promise<CommuneYear> {
  const key = `${cityCode}:${year}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${BASE}/${year}/communes/${departmentCode}/${cityCode}.csv`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // A year with no published file yet — the current one, most of the time.
  if (!res.ok) return { comparables: { maison: [], appartement: [] }, landPricesCents: [] };

  const parsed = Papa.parse<DvfRow>(await res.text(), {
    header: true,
    skipEmptyLines: true,
  });
  const year_: CommuneYear = {
    comparables: Object.fromEntries(
      PROPERTY_KINDS.map((kind) => [kind, toComparables(parsed.data, kind)]),
    ) as Record<PropertyKind, Comparable[]>,
    landPricesCents: toLandPricesCents(parsed.data),
  };
  cache.set(key, year_);
  return year_;
}

/** The median of a sorted-in-place copy, or null when there is nothing to say. */
function median(values: number[], minimum: number): number | null {
  if (values.length < minimum) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type CommuneMarket = {
  comparables: Comparable[];
  /** Median €/m² of bare ground, cents. Null when too little of it sold. */
  landRateCents: number | null;
};

/** Every usable sale of `kind` in that commune over the last `YEARS_BACK` years. */
export async function fetchComparables(
  departmentCode: string,
  cityCode: string,
  kind: PropertyKind,
  now: Date,
): Promise<CommuneMarket> {
  const latest = now.getFullYear();
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => latest - i);
  const perYear = await Promise.all(
    years.map((year) => fetchYear(departmentCode, cityCode, year)),
  );
  return {
    comparables: perYear.flatMap((y) => y.comparables[kind]),
    landRateCents: median(
      perYear.flatMap((y) => y.landPricesCents),
      MIN_LAND_SALES,
    ),
  };
}
