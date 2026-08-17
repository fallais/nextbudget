import { DomainError } from "@domain/errors";

/**
 * An amount of money, held as signed integer cents.
 *
 * Cents, never floats: 0.1 + 0.2 has no place in a ledger. The sign carries
 * meaning throughout the app — a debit is negative, a credit positive — so
 * Money keeps it rather than storing a magnitude and a direction separately.
 */
export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new DomainError("Un montant doit être un nombre entier de centimes.", "money.not_integer");
    }
    if (!Number.isSafeInteger(cents)) {
      throw new DomainError("Montant hors limites.", "money.out_of_range");
    }
    return new Money(cents);
  }

  /** For amounts that cannot be negative: a loan principal, a budget. */
  static positiveFromCents(cents: number): Money {
    const m = Money.fromCents(cents);
    if (m.cents < 0) {
      throw new DomainError("Ce montant doit être positif.", "money.negative");
    }
    return m;
  }

  static readonly zero = new Money(0);

  get isZero(): boolean {
    return this.cents === 0;
  }

  get isNegative(): boolean {
    return this.cents < 0;
  }

  abs(): Money {
    return new Money(Math.abs(this.cents));
  }

  negated(): Money {
    return new Money(-this.cents);
  }

  plus(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  minus(other: Money): Money {
    return Money.fromCents(this.cents - other.cents);
  }

  /** Rounded to the nearest cent — the caller decides if drift matters. */
  times(factor: number): Money {
    return Money.fromCents(Math.round(this.cents * factor));
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }
}
