import { AggregateRoot } from "@domain/ddd";
import { invariant } from "@domain/errors";
import { Money } from "@domain/value-objects/money";

export interface TransactionRow {
  id: number;
  accountId: number;
  categoryId: number | null;
  /** ISO yyyy-MM-dd. Text, because a bank line falls on a day, not an instant. */
  date: string;
  description: string;
  normalizedDescription: string;
  amountCents: number;
  currency: string;
  /** sha256(date|amountCents|normalizedDescription) — unique per account. */
  hash: string;
  sourceFile: string | null;
  raw: Record<string, unknown> | null;
  createdAt: Date;
}

export type NewTransaction = Omit<TransactionRow, "id" | "createdAt">;

/** A single line of a bank statement. */
export class Transaction extends AggregateRoot<TransactionRow> {
  private constructor(row: TransactionRow) {
    super(row);
  }

  static reconstitute(row: TransactionRow): Transaction {
    return new Transaction(row);
  }

  static create(input: NewTransaction): Transaction {
    invariant(
      /^\d{4}-\d{2}-\d{2}$/.test(input.date),
      "La date doit être au format AAAA-MM-JJ.",
      "transaction.date_invalid",
    );
    invariant(input.hash.length > 0, "Empreinte de déduplication manquante.", "transaction.hash_missing");
    Money.fromCents(input.amountCents);
    return new Transaction({ ...input, id: 0, createdAt: new Date() });
  }

  get accountId(): number {
    return this.row.accountId;
  }
  get categoryId(): number | null {
    return this.row.categoryId;
  }
  get date(): string {
    return this.row.date;
  }
  get normalizedDescription(): string {
    return this.row.normalizedDescription;
  }

  get amount(): Money {
    return Money.fromCents(this.row.amountCents);
  }

  /** Money arriving: a salary, an apport, a refund. */
  get isCredit(): boolean {
    return this.row.amountCents > 0;
  }

  get isCategorized(): boolean {
    return this.row.categoryId !== null;
  }

}
