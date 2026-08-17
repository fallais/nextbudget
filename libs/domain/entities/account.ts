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

}
