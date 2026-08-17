import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import type { AmountCondition, MatchType, Visibility } from "@domain/enums";

export interface RuleRow {
  id: number;
  ownerId: number | null;
  visibility: Visibility;
  categoryId: number;
  pattern: string;
  matchType: MatchType;
  amountCondition: AmountCondition;
  /** Lower wins, so a specific merchant can outrank a generic fallback. */
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export type NewRule = Omit<RuleRow, "id" | "createdAt">;

/** A merchant pattern that assigns a category to matching transactions. */
export class Rule extends Entity<RuleRow> {
  private constructor(row: RuleRow) {
    super(row);
  }

  static reconstitute(row: RuleRow): Rule {
    return new Rule(row);
  }

  static create(input: NewRule): Rule {
    invariant(input.pattern.trim().length > 0, "Le motif est obligatoire.", "rule.pattern_required");
    if (input.matchType === "regex") {
      // A bad regex would otherwise throw on every categorisation run.
      try {
        new RegExp(input.pattern, "i");
      } catch {
        invariant(false, "Expression régulière invalide.", "rule.regex_invalid");
      }
    }
    return new Rule({ ...input, id: 0, createdAt: new Date() });
  }

  get categoryId(): number {
    return this.row.categoryId;
  }
  get priority(): number {
    return this.row.priority;
  }
  get isActive(): boolean {
    return this.row.isActive;
  }

}
