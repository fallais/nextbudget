import { AggregateRoot } from "@domain/ddd";
import { invariant } from "@domain/errors";
import type { AccountKind, Visibility } from "@domain/enums";

export interface AccountRow {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  kind: AccountKind;
  name: string;
  bank: string | null;
  iban: string | null;
  currency: string;
  /**
   * What the bank said was in the account on `openingBalanceDate`.
   *
   * Without it there is no balance to show, only the net of whatever was
   * imported — a statement starting in May sums to "net since May", which is
   * not what is in the account and must not be presented as if it were. Null
   * means the question has not been answered yet.
   */
  openingBalanceCents: number | null;
  /** When that balance was true. Null reads as "before the first import". */
  openingBalanceDate: string | null;
  createdAt: Date;
}

export type NewAccount = Omit<AccountRow, "id" | "createdAt">;

export class Account extends AggregateRoot<AccountRow> {
  private constructor(row: AccountRow) {
    super(row);
  }

  static reconstitute(row: AccountRow): Account {
    return new Account(row);
  }

  static create(input: NewAccount): Account {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "account.name_required");
    invariant(
      input.currency.trim().length === 3,
      "La devise doit être un code à trois lettres.",
      "account.currency_invalid",
    );
    invariant(
      input.openingBalanceDate == null || input.openingBalanceCents != null,
      "Un solde de départ est nécessaire pour lui donner une date.",
      "account.opening_balance_required",
    );
    return new Account({ ...input, id: 0, createdAt: new Date() });
  }

  get name(): string {
    return this.row.name;
  }
  get kind(): AccountKind {
    return this.row.kind;
  }
  get ownerId(): number | null {
    return this.row.ownerId;
  }
  get visibility(): Visibility {
    return this.row.visibility;
  }

  /** The common pot: the only account contributions are matched against. */
  get isJoint(): boolean {
    return this.row.kind === "joint";
  }

  /** Whether a real balance can be computed, or only a net of movements. */
  get hasOpeningBalance(): boolean {
    return this.row.openingBalanceCents != null;
  }

}
