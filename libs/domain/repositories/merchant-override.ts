import type {
  MerchantOverride,
  MerchantOverrideRow,
  NewMerchantOverride,
} from "@domain/entities";
import type { Repository } from "./repository";

/**
 * Overrides are addressed by merchant key, not by id: the UI knows which
 * merchant it is editing, never which row happens to hold that decision.
 */
export interface MerchantOverrideRepository
  extends Repository<MerchantOverride, MerchantOverrideRow, NewMerchantOverride> {
  findByKey(merchantKey: string): Promise<MerchantOverride | null>;
  deleteByKey(merchantKey: string): Promise<boolean>;
}
