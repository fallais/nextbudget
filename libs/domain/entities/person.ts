import { AggregateRoot } from "@domain/ddd";
import { invariant } from "@domain/errors";
import type { PersonMatchType } from "@domain/enums";

export interface PersonRow {
  id: number;
  /** The login this member speaks for, when they have one. */
  userId: number | null;
  name: string;
  monthlySalaryCents: number | null;
  /** Catches every incoming transfer from this person, however it is worded. */
  matchPattern: string | null;
  matchType: PersonMatchType | null;
  tolerancePct: number;
  isActive: boolean;
  createdAt: Date;
}

export type NewPerson = Omit<PersonRow, "id" | "createdAt">;

/**
 * A member of the household.
 *
 * Deliberately distinct from `User`: a person needs no login. Ownership shares
 * and contributions attach to people, so they keep working in open mode where
 * nobody signs in.
 */
export class Person extends AggregateRoot<PersonRow> {
  private constructor(row: PersonRow) {
    super(row);
  }

  static reconstitute(row: PersonRow): Person {
    return new Person(row);
  }

  static create(input: NewPerson): Person {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "person.name_required");
    invariant(
      input.tolerancePct >= 0 && input.tolerancePct <= 100,
      "La tolérance doit être comprise entre 0 et 100 %.",
      "person.tolerance_invalid",
    );
    return new Person({ ...input, id: 0, createdAt: new Date() });
  }

  get name(): string {
    return this.row.name;
  }
  get userId(): number | null {
    return this.row.userId;
  }
  get isActive(): boolean {
    return this.row.isActive;
  }

  get hasLogin(): boolean {
    return this.row.userId !== null;
  }

  /** Whether consolidated apports can be attributed to this person at all. */
  get hasBroadPattern(): boolean {
    return (this.row.matchPattern?.trim().length ?? 0) > 0;
  }

}
