import "server-only";
import { assets } from "@infrastructure/persistence/repositories";
import { geocode } from "@infrastructure/estimation/geocode";
import { fetchComparables } from "@infrastructure/estimation/dvf";
import type { AssetRepository } from "@domain/repositories";
import type { ComparableSource, Geocoder } from "./ports";
import {
  estimate,
  fitLandWeight,
  type Estimate,
  type Subject,
} from "@domain/services/estimation";
import type { EstimationRow, NewEstimation } from "@domain/entities";

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
 *
 * Which is the reason the answer is kept. Recomputing to see a figure you have
 * already been given would mean sending the address again for nothing, so an
 * estimate that succeeds is recorded, and the page reads the last one instead.
 * The open data itself is still never stored: the CSVs are read, the median is
 * taken, and they are dropped.
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
  | { status: "ok"; estimate: Estimate; address: string; saved: EstimationRow }
  | { status: "not_found" }
  /** Which of the three inputs an estimate needs are still missing. */
  | { status: "incomplete"; missing: ("address" | "surfaceM2" | "propertyKind")[] }
  | { status: "not_geocoded" }
  | { status: "too_few_sales" };

/**
 * The row an estimate is stored as.
 *
 * Its own function so it can be checked. Nineteen fields copied across by hand
 * is the kind of place where `lowCents: result.highCents` reads fine, passes
 * every type check, and quietly writes the wrong number for as long as the
 * database lives.
 */
export function toNewEstimation(
  assetId: number,
  result: Estimate,
  address: string,
  subject: Subject,
): NewEstimation {
  return {
    assetId,
    valueCents: result.valueCents,
    pricePerM2Cents: result.pricePerM2Cents,
    lowCents: result.lowCents,
    highCents: result.highCents,
    marketCents: result.marketCents,
    landAdjustmentCents: result.landAdjustmentCents,
    conditionAdjustmentCents: result.conditionAdjustmentCents,
    comparableLandM2: result.comparableLandM2,
    creditedLandM2: result.creditedLandM2,
    sampleSize: result.sampleSize,
    radiusM: result.radiusM,
    oldestDate: result.oldestDate,
    newestDate: result.newestDate,
    address,
    // The inputs as they stood, not as they will stand when this is read back.
    surfaceM2: subject.surfaceM2,
    landM2: subject.landM2,
    condition: subject.condition,
  };
}

/**
 * What estimating needs, and nothing else it happens to sit next to.
 *
 * `Pick` rather than the whole `AssetRepository`: this use case reads one
 * asset and appends one estimate, so that is what it asks for, and a stand-in
 * is two functions rather than the twenty a full repository would demand.
 */
export type EstimationDeps = {
  assets: Pick<AssetRepository, "findById" | "addEstimation">;
  geocode: Geocoder;
  fetchComparables: ComparableSource;
};

/**
 * The real ones, as a default argument.
 *
 * Callers pass nothing and get the application wired up; a test passes its own
 * and gets a use case that touches neither the database nor the network. No
 * container, no registry, no indirection to read past — the seam is the
 * parameter list.
 */
const LIVE: EstimationDeps = { assets, geocode, fetchComparables };

export async function estimateAsset(
  assetId: number,
  now: Date = new Date(),
  deps: EstimationDeps = LIVE,
): Promise<EstimationOutcome> {
  const { assets: assetRepo, geocode: locate, fetchComparables: comparablesFor } = deps;
  const asset = await assetRepo.findById(assetId);
  if (!asset) return { status: "not_found" };

  const row = asset.toRow();
  const missing: ("address" | "surfaceM2" | "propertyKind")[] = [];
  if (!row.address?.trim()) missing.push("address");
  if (!row.surfaceM2) missing.push("surfaceM2");
  if (!row.propertyKind) missing.push("propertyKind");
  if (missing.length > 0) return { status: "incomplete", missing };

  const located = await locate(row.address!);
  if (!located) return { status: "not_geocoded" };

  const market = await comparablesFor(
    located.departmentCode,
    located.cityCode,
    row.propertyKind!,
    now,
  );

  // Fitted once for the commune, not once per circle: it is a fact about the
  // local market, and the three radii are three views of the same one.
  const land = fitLandWeight(market.comparables, market.landRateCents, RADII_M);

  const subject = {
    surfaceM2: row.surfaceM2!,
    landM2: row.landM2,
    latitude: located.latitude,
    longitude: located.longitude,
    condition: row.propertyCondition,
  };
  for (const radius of RADII_M) {
    const result = estimate(subject, market.comparables, radius, land);
    if (!result) continue;
    const saved = await assetRepo.addEstimation(
      toNewEstimation(assetId, result, located.label, subject),
    );
    return { status: "ok", estimate: result, address: located.label, saved: saved.toRow() };
  }
  return { status: "too_few_sales" };
}

/** Every estimate recorded for a property, newest first. */
export async function listEstimations(assetId: number): Promise<EstimationRow[]> {
  return assets.listEstimations(assetId);
}

/** Resolves `false` when that property has no estimate with that id. */
export async function deleteEstimation(assetId: number, estimationId: number): Promise<boolean> {
  return assets.deleteEstimation(assetId, estimationId);
}
