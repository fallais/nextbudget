import "server-only";
import { Asset, type AssetRow, type PrepaymentRow } from "@domain/entities";
import {
  insuranceMonthlyFrom,
  summarizeLoan,
  type LoanSummary,
} from "@domain/services/amortization";
import { listAssetOwners, listAssets } from "@application/assets";
import { assets } from "@infrastructure/persistence/repositories";
import { listMembers } from "@application/household";

/**
 * Credits — the liabilities in `assets`, seen as loans rather than as negative
 * net worth.
 *
 * There is no `credits` table and there should not be: a mortgage already *is*
 * an asset row with `kind: "liability"`, it already carries the loan terms, and
 * it already contributes to net worth. A separate table would duplicate all of
 * that and then have to be kept in step with it. What was missing was a place
 * to manage them as loans, which is what this reads for.
 *
 * The tie to what the loan paid for is `assets.linked_asset_id` — the column
 * the asset form already fills when you add a property and its mortgage
 * together. This surfaces it, and lets it be changed afterwards.
 */

/** One borrower's premium on this loan, for display beside their name. */
export type BorrowerInsurance = {
  personId: number;
  personName: string;
  shareBps: number;
  monthlyCents: number | null;
};

export type CreditListItem = {
  credit: AssetRow;
  /** What the loan funded, when it is attached to something. */
  linkedAsset: Pick<AssetRow, "id" | "name" | "type" | "valueCents"> | null;
  /** Null when capital, rate or term are missing — nothing honest to compute. */
  summary: LoanSummary | null;
  /** Empty unless the loan is split between borrowers. */
  borrowers: BorrowerInsurance[];
  /** Months between signature and first instalment, when deferred. */
  deferralMonths: number | null;
  /** Capital repaid ahead of schedule, oldest first. */
  prepayments: PrepaymentRow[];
};

/** Local date, not UTC: an instalment falls on a calendar day, not an instant. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLoanInput(a: AssetRow, insuranceMonthlyCents: number, prepayments: PrepaymentRow[]) {
  if (a.principalCents == null || a.interestRateBps == null || !a.termMonths) return null;
  return {
    principalCents: a.principalCents,
    interestRateBps: a.interestRateBps,
    termMonths: a.termMonths,
    monthlyPaymentCents: a.monthlyPaymentCents,
    insuranceMonthlyCents,
    feesCents: a.feesCents,
    startDate: a.startDate,
    prepayments: prepayments.map((p) => ({
      date: p.date,
      amountCents: p.amountCents,
      mode: p.mode,
      feesCents: p.feesCents,
    })),
  };
}

export async function listCredits(): Promise<CreditListItem[]> {
  const all = await listAssets();
  const byId = new Map(all.map((a) => [a.id, a]));
  const today = todayIso();

  const liabilities = all.filter((a) => a.kind === "liability");
  const [ownerRows, members, prepaymentRows] = await Promise.all([
    listAssetOwners(liabilities.map((a) => a.id)),
    listMembers(),
    assets.listPrepayments(liabilities.map((a) => a.id)),
  ]);
  const personName = new Map(members.map((m) => [m.person.id, m.person.name]));

  return liabilities.map((credit) => {
    const linked = credit.linkedAssetId != null ? byId.get(credit.linkedAssetId) : undefined;

    const shares = ownerRows.get(credit.id) ?? [];
    const borrowers: BorrowerInsurance[] = shares
      .map((s) => ({
        personId: s.personId,
        personName: personName.get(s.personId) ?? "—",
        shareBps: s.shareBps,
        monthlyCents: s.insuranceMonthlyCents,
      }))
      .sort((a, b) => a.personName.localeCompare(b.personName, "fr"));

    // Per-borrower premiums, when stated, replace the loan-level figure — the
    // two would otherwise be added together and double the insurance.
    const insurance = insuranceMonthlyFrom(
      credit.insuranceMonthlyCents,
      borrowers.map((b) => b.monthlyCents),
    );
    const prepayments = prepaymentRows.get(credit.id) ?? [];
    const loan = toLoanInput(credit, insurance, prepayments);

    return {
      credit,
      // A link pointing at a deleted or invisible asset reads as no link
      // rather than as a dangling id.
      linkedAsset:
        linked && linked.kind === "asset"
          ? { id: linked.id, name: linked.name, type: linked.type, valueCents: linked.valueCents }
          : null,
      summary: loan ? summarizeLoan(loan, today) : null,
      // Only interesting when the loan is actually shared.
      borrowers: borrowers.length > 1 ? borrowers : [],
      deferralMonths: Asset.reconstitute(credit).deferralMonths,
      prepayments,
    };
  });
}

/** Assets a credit can be attached to: the things a loan could have paid for. */
export async function listLinkableAssets(): Promise<Pick<AssetRow, "id" | "name">[]> {
  const all = await listAssets();
  return all.filter((a) => a.kind === "asset").map((a) => ({ id: a.id, name: a.name }));
}

export type CreditsTotals = {
  count: number;
  /** Sum of outstanding balances — what is still owed today. */
  outstandingCents: number;
  /**
   * The échéances alone: capital + interest, as the offre de prêt quotes them.
   * Kept apart from the insurance because a lender often debits the premium
   * separately, and folding the two into one figure makes the app look like it
   * disagrees with the contract.
   */
  monthlyPaymentCents: number;
  /** What leaves the account every month, insurance included. */
  monthlyTotalCents: number;
  /** Interest + insurance + fees over the whole life of every loan. */
  totalCostCents: number;
};

export function summarizeCredits(items: CreditListItem[]): CreditsTotals {
  const active = items.filter((i) => i.credit.isActive);
  return {
    count: active.length,
    outstandingCents: active.reduce((sum, i) => sum + i.credit.valueCents, 0),
    monthlyPaymentCents: active.reduce((sum, i) => sum + (i.summary?.monthlyPaymentCents ?? 0), 0),
    monthlyTotalCents: active.reduce((sum, i) => sum + (i.summary?.monthlyTotalCents ?? 0), 0),
    totalCostCents: active.reduce((sum, i) => sum + (i.summary?.totalCostCents ?? 0), 0),
  };
}
