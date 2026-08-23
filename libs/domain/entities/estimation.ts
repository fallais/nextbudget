import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import type { PropertyCondition } from "@domain/enums";

export interface EstimationRow {
  id: number;
  /** The property this was an estimate of. */
  assetId: number;
  /** What the whole method arrived at: market, plot and condition together. */
  valueCents: number;
  pricePerM2Cents: number;
  lowCents: number;
  highCents: number;
  /** The comparables alone, before either adjustment. */
  marketCents: number;
  landAdjustmentCents: number;
  conditionAdjustmentCents: number;
  /** The comps' median plot, and the plot actually paid for. */
  comparableLandM2: number | null;
  creditedLandM2: number | null;
  sampleSize: number;
  radiusM: number;
  /** The span of sales it was drawn from. */
  oldestDate: string;
  newestDate: string;
  /** The address as the geocoder understood it. */
  address: string;
  /**
   * The inputs as they stood, because they are what makes an old figure
   * readable. A property gains a veranda and loses a hectare; without the
   * surface and the plot it was computed on, last year's number is a number.
   */
  surfaceM2: number;
  landM2: number | null;
  condition: PropertyCondition | null;
  createdAt: Date;
}

export type NewEstimation = Omit<EstimationRow, "id" | "createdAt">;

/**
 * One dated answer to "what is this worth", kept.
 *
 * Estimating reaches out to a geocoder and an open-data host, so it is a
 * deliberate act and never something a page render triggers. That is exactly
 * why the answer is stored: without it the only way to see a figure is to send
 * the address again, and a property's value is a thing you want to glance at
 * far more often than you want to recompute it.
 *
 * Stored whole rather than as one number. The breakdown is what makes it
 * arguable — a figure carrying 114 k€ of plot credit invites a different
 * question than one that is all comparables — and a bare total would throw
 * that away.
 */
export class Estimation extends Entity<EstimationRow> {
  private constructor(row: EstimationRow) {
    super(row);
  }

  static reconstitute(row: EstimationRow): Estimation {
    return new Estimation(row);
  }

  static create(input: NewEstimation): Estimation {
    invariant(
      input.sampleSize > 0,
      "Une estimation sans vente comparable n'en est pas une.",
      "estimation.sample_required",
    );
    invariant(
      input.surfaceM2 > 0,
      "La surface estimée doit être positive.",
      "estimation.surface_required",
    );
    return new Estimation({ ...input, id: 0, createdAt: new Date() });
  }

  get assetId(): number {
    return this.row.assetId;
  }
}
