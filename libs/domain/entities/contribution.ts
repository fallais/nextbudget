import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import type { ContributionState, PersonMatchType, Visibility } from "@domain/enums";

export interface ContributionRow {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  personId: number;
  name: string;
  expectedAmountCents: number;
  matchPattern: string;
  matchType: PersonMatchType;
  /** How far the received amount may drift before it counts as an anomaly. */
  tolerancePct: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export type NewContribution = Omit<ContributionRow, "id" | "createdAt">;



/** A monthly transfer a household member makes into the common account. */
export class Contribution extends Entity<ContributionRow> {
  private constructor(row: ContributionRow) {
    super(row);
  }

  static reconstitute(row: ContributionRow): Contribution {
    return new Contribution(row);
  }

  static create(input: NewContribution): Contribution {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "contribution.name_required");
    invariant(
      input.matchPattern.trim().length > 0,
      "Le motif de rapprochement est obligatoire.",
      "contribution.pattern_required",
    );
    Money.positiveFromCents(input.expectedAmountCents);
    invariant(
      input.tolerancePct >= 0 && input.tolerancePct <= 100,
      "La tolérance doit être comprise entre 0 et 100 %.",
      "contribution.tolerance_invalid",
    );
    return new Contribution({ ...input, id: 0, createdAt: new Date() });
  }

  get personId(): number {
    return this.row.personId;
  }
  get isActive(): boolean {
    return this.row.isActive;
  }
  get expected(): Money {
    return Money.fromCents(this.row.expectedAmountCents);
  }

  /**
   * How a received total compares with what was expected. Nothing received is
   * "pending" rather than an anomaly: the month may simply not be over.
   */
  stateFor(receivedCents: number): ContributionState {
    if (receivedCents === 0) return "pending";
    const variance =
      Math.abs(receivedCents - this.row.expectedAmountCents) / this.row.expectedAmountCents;
    return variance * 100 <= this.row.tolerancePct ? "received" : "anomaly";
  }

}
