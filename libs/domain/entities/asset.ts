import { AggregateRoot } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";
import { Share, TOTAL_BPS } from "@domain/value-objects/share";
import {
  deferralMonthsBetween,
  summarizeLoan,
  type Prepayment,
} from "@domain/services/amortization";

import type { AssetKind, AssetType, PropertyKind, Visibility } from "@domain/enums";
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
  /** Taux nominal (débiteur): what the amortization schedule is built on. */
  interestRateBps: number | null;
  /**
   * TAEG as printed on the offer, when the borrower recorded it.
   *
   * Never used to compute anything — it is the headline rate, already
   * including insurance and fees, so amortizing with it would double-count
   * them. Stored so the app can check it against the TAEG its own terms imply
   * and catch the common mix-up of the two.
   */
  taegBps: number | null;
  termMonths: number | null;
  monthlyPaymentCents: number | null;
  /** Assurance emprunteur, per month. Often a fifth of a French mortgage's cost. */
  insuranceMonthlyCents: number | null;
  /** One-off costs: frais de dossier, garantie, courtier. */
  feesCents: number | null;
  /**
   * When the loan was signed, which is not when it starts being repaid.
   *
   * A crédit différé (deferred mortgage, or one released in stages while a
   * property is built) is signed months before its first instalment falls due.
   * The schedule is anchored on `startDate` — the first instalment — while this
   * records the commitment itself.
   */
  signatureDate: string | null;
  /** First instalment. What the amortization schedule is anchored on. */
  startDate: string | null;
  endDate: string | null;
  /**
   * Where it is, and how big — the two facts a valuation needs and the app
   * otherwise has nowhere to keep. Only ever filled in for property.
   */
  address: string | null;
  surfaceM2: number | null;
  propertyKind: PropertyKind | null;
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

  /** A dated schedule exists, so the balance can be derived rather than typed. */
  get hasDerivableBalance(): boolean {
    return this.hasLoanTerms && this.row.startDate != null;
  }

  /**
   * Whole months between signing and the first instalment — the différé.
   *
   * Null when either date is missing or they fall in the same month, which is
   * the ordinary case: most loans start repaying straight away and have no
   * deferral worth naming.
   */
  get deferralMonths(): number | null {
    return deferralMonthsBetween(this.row.signatureDate, this.row.startDate);
  }

  /**
   * Capital still owed on `today`.
   *
   * For a loan with terms and a start date this is a fact, not an opinion: the
   * schedule says exactly how much principal each instalment has retired. Asking
   * the user to keep a `value_cents` figure up to date by hand only produces a
   * number that is wrong from the month after it is typed, and silently drags
   * net worth with it.
   *
   * Everything else — a debt with no terms, a loan whose start is unknown —
   * falls back to the stored value, because there is nothing to derive from.
   *
   * `prepayments` belong to another table, so they are passed in. Leaving them
   * out does not merely lose them: it reports a balance the borrower has not
   * owed since the day they paid it down.
   */
  outstandingCents(today: string, prepayments: Prepayment[] = []): number {
    if (!this.hasDerivableBalance) return this.row.valueCents;
    const summary = summarizeLoan(
      {
        principalCents: this.row.principalCents as number,
        interestRateBps: this.row.interestRateBps as number,
        termMonths: this.row.termMonths as number,
        monthlyPaymentCents: this.row.monthlyPaymentCents,
        insuranceMonthlyCents: this.row.insuranceMonthlyCents,
        feesCents: this.row.feesCents,
        startDate: this.row.startDate,
        prepayments,
      },
      today,
    );
    return summary?.progress?.principalRemainingCents ?? this.row.valueCents;
  }

  /** The row as it should be read: balance derived where one can be. */
  toRowAt(today: string, prepayments: Prepayment[] = []): AssetRow {
    return { ...this.row, valueCents: this.outstandingCents(today, prepayments) };
  }

  /**
   * A person's slice of this asset, signed as it counts toward their net worth.
   */
  shareOf(share: Share): Money {
    return this.netWorthContribution.times(share.bps / TOTAL_BPS);
  }

}
