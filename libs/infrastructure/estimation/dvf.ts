import Papa from "papaparse";
import type { Comparable } from "@domain/services/estimation";
import type { PropertyKind } from "@domain/enums";

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

/** The columns this reads. DVF has forty; these are the ones that matter. */
export type DvfRow = {
  id_mutation: string;
  date_mutation: string;
  nature_mutation: string;
  valeur_fonciere: string;
  type_local: string;
  surface_reelle_bati: string;
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
  const byMutation = new Map<string, DvfRow[]>();
  for (const row of rows) {
    if (row.nature_mutation !== "Vente") continue;
    const group = byMutation.get(row.id_mutation);
    if (group) group.push(row);
    else byMutation.set(row.id_mutation, [row]);
  }

  const comparables: Comparable[] = [];
  for (const group of byMutation.values()) {
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
      date: row.date_mutation,
      latitude,
      longitude,
    });
  }
  return comparables;
}

// One commune-year is immutable once published, so a process that estimates
// the same house twice should not fetch it twice. Bounded by the number of
// communes anyone looks at, which for a household budget is one or two.
const cache = new Map<string, Comparable[]>();

async function fetchYear(
  departmentCode: string,
  cityCode: string,
  year: number,
  kind: PropertyKind,
): Promise<Comparable[]> {
  const key = `${cityCode}:${year}:${kind}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${BASE}/${year}/communes/${departmentCode}/${cityCode}.csv`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // A year with no published file yet — the current one, most of the time.
  if (!res.ok) return [];

  const parsed = Papa.parse<DvfRow>(await res.text(), {
    header: true,
    skipEmptyLines: true,
  });
  const comparables = toComparables(parsed.data, kind);
  cache.set(key, comparables);
  return comparables;
}

/** Every usable sale of `kind` in that commune over the last `YEARS_BACK` years. */
export async function fetchComparables(
  departmentCode: string,
  cityCode: string,
  kind: PropertyKind,
  now: Date,
): Promise<Comparable[]> {
  const latest = now.getFullYear();
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => latest - i);
  const perYear = await Promise.all(
    years.map((year) => fetchYear(departmentCode, cityCode, year, kind)),
  );
  return perYear.flat();
}
