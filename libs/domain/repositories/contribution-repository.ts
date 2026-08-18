import type { Contribution, ContributionRow, NewContribution } from "@domain/entities";
import type { Repository } from "./repository";

export interface ContributionRepository
  extends Repository<Contribution, ContributionRow, NewContribution> {
  /**
   * Contributions belong to a person — they are inside that aggregate, not
   * beside it — so removing the person removes them. Without FK constraints in
   * the schema, this is where that cascade lives.
   */
  deleteByPerson(personId: number): Promise<void>;
}
