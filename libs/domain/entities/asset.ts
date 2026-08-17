import { AggregateRoot } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import { Share, TOTAL_BPS } from "@domain/value-objects/share";

import type { AssetKind, AssetType, Visibility } from "@domain/enums";
import { typesFor } from "@domain/enums";

/** The persisted shape. Also what crosses to the UI, where classes cannot go. */
export interface AssetRow {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  name: string;
  kind: AssetKind;
  type: AssetType;
  valueCents: number;
  currency: string;
  principalCents: number | null;
  interestRateBps: number | null;
  termMonths: number | null;
  monthlyPaymentCents: number | null;
  /** Assurance emprunteur, per month. Often a fifth of a French mortgage's cost. */
  insuranceMonthlyCents: number | null;
  /** One-off costs: frais de dossier, garantie, courtier. */
  feesCents: number | null;
  startDate: string | null;
  endDate: string | null;
  accountId: number | null;
  /** The asset this liability finances (a mortgage → the house it bought). */
  linkedAssetId: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export type NewAsset = Omit<AssetRow, "id" | "createdAt">;

/**
 * Something owned or owed: a house, a savings account, a mortgage.
 *
 * Assets are the aggregate root for ownership: the rule that shares total
 * exactly 100% belongs here, because it is only true of the whole set and
 * cannot be checked one row at a time.
 */
export class Asset extends AggregateRoot<AssetRow> {
  private constructor(row: AssetRow) {
    super(row);
  }

  /** Rebuild from storage. Trusted: a persisted row was valid when written. */
  static reconstitute(row: AssetRow): Asset {
    return new Asset(row);
  }

  /** Build from user input, refusing anything the app should never store. */
  static create(input: NewAsset): Asset {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "asset.name_required");
    invariant(
      typesFor(input.kind).includes(input.type),
      `Un ${input.kind === "asset" ? "actif" : "passif"} ne peut pas être de ce type.`,
      "asset.type_mismatch",
    );
    // Value is a magnitude: a debt is negative by virtue of being a liability,
    // never by carrying a minus sign, or net worth would double-count the sign.
    Money.positiveFromCents(input.valueCents);
    if (input.termMonths != null) {
      invariant(input.termMonths > 0, "La durée doit être positive.", "asset.term_invalid");
    }
    if (input.interestRateBps != null) {
      invariant(
        input.interestRateBps >= 0,
        "Le taux ne peut pas être négatif.",
        "asset.rate_invalid",
      );
    }
    return new Asset({ ...input, id: 0, createdAt: new Date() });
  }

  static typesFor(kind: AssetKind): readonly AssetType[] {
    return typesFor(kind);
  }

  get name(): string {
    return this.row.name;
  }
  get kind(): AssetKind {
    return this.row.kind;
  }
  get type(): AssetType {
    return this.row.type;
  }
  get ownerId(): number | null {
    return this.row.ownerId;
  }
  get isActive(): boolean {
    return this.row.isActive;
  }

  get value(): Money {
    return Money.fromCents(this.row.valueCents);
  }

  /** Signed for net worth: an asset adds, a liability subtracts. */
  get netWorthContribution(): Money {
    return this.row.kind === "asset" ? this.value : this.value.negated();
  }

  /** Only a debt with terms can produce a schedule. */
  get isLoan(): boolean {
    return (
      this.row.kind === "liability" &&
      (this.row.type === "loan" || this.row.type === "mortgage")
    );
  }

  get hasLoanTerms(): boolean {
    return (
      this.isLoan &&
      this.row.principalCents != null &&
      this.row.interestRateBps != null &&
      this.row.termMonths != null
    );
  }

  /**
   * A person's slice of this asset, signed as it counts toward their net worth.
   */
  shareOf(share: Share): Money {
    return this.netWorthContribution.times(share.bps / TOTAL_BPS);
  }

}
