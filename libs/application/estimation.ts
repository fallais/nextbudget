import "server-only";
import { assets } from "@infrastructure/persistence/repositories";
import { geocode } from "@infrastructure/estimation/geocode";
import { fetchComparables } from "@infrastructure/estimation/dvf";
import { estimate, type Estimate } from "@domain/services/estimation";

/**
 * Estimating a property from the public record of what sold nearby.
 *
 * Assembly only: the arithmetic is a domain service and the two network calls are
 * infrastructure, so what is left here is the order to do them in and what to
 * say when one of them cannot answer.
 *
 * Nothing runs unless someone asks. An address and a house's dimensions leave
 * the machine on this path — the geocoder sees the address, the open-data host
 * sees which commune was asked for — and a local-first app should only do that
 * on a click, never on a page load.
 */

/**
 * Tried in turn, stopping at the first that has enough sales to speak for.
 *
 * Near neighbours are the better comparison; a wider circle is what you settle
 * for when the street has not changed hands in three years. Past the third the
 * comparison stops meaning anything, so the answer becomes "not enough sales"
 * rather than a number drawn from the far side of town.
 */
const RADII_M = [500, 1500, 5000];

export type EstimationOutcome =
  | { status: "ok"; estimate: Estimate; address: string }
  | { status: "not_found" }
  /** Which of the three inputs an estimate needs are still missing. */
  | { status: "incomplete"; missing: ("address" | "surfaceM2" | "propertyKind")[] }
  | { status: "not_geocoded" }
  | { status: "too_few_sales" };

export async function estimateAsset(
  assetId: number,
  now: Date = new Date(),
): Promise<EstimationOutcome> {
  const asset = await assets.findById(assetId);
  if (!asset) return { status: "not_found" };

  const row = asset.toRow();
  const missing: ("address" | "surfaceM2" | "propertyKind")[] = [];
  if (!row.address?.trim()) missing.push("address");
  if (!row.surfaceM2) missing.push("surfaceM2");
  if (!row.propertyKind) missing.push("propertyKind");
  if (missing.length > 0) return { status: "incomplete", missing };

  const located = await geocode(row.address!);
  if (!located) return { status: "not_geocoded" };

  const comparables = await fetchComparables(
    located.departmentCode,
    located.cityCode,
    row.propertyKind!,
    now,
  );

  const subject = {
    surfaceM2: row.surfaceM2!,
    latitude: located.latitude,
    longitude: located.longitude,
  };
  for (const radius of RADII_M) {
    const result = estimate(subject, comparables, radius);
    if (result) return { status: "ok", estimate: result, address: located.label };
  }
  return { status: "too_few_sales" };
}
