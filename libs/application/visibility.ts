import "server-only";
import type { Visibility } from "@domain/enums";
import {
  accounts,
  assets,
  budgets,
  contributions,
  fixedExpenses,
  rules,
} from "@infrastructure/persistence/repositories";

/**
 * Per-row visibility toggles.
 *
 * Visibility is one of the three axes the household design keeps separate —
 * who can *see* a row, as opposed to who owns a share of it or who pays for
 * it. Only the tables that carry `owner_id`/`visibility` can be toggled, which
 * is why this is a closed set rather than a generic "update any table" call.
 */
export type OwnableKind =
  | "account"
  | "asset"
  | "budget"
  | "contribution"
  | "fixedExpense"
  | "rule";

const REPOSITORIES = {
  account: accounts,
  asset: assets,
  budget: budgets,
  contribution: contributions,
  fixedExpense: fixedExpenses,
  rule: rules,
} as const;

/** Resolves `false` when nothing had that id. */
export async function setVisibility(
  kind: OwnableKind,
  id: number,
  visibility: Visibility,
): Promise<boolean> {
  const updated = await REPOSITORIES[kind].update(id, { visibility });
  return updated !== null;
}
