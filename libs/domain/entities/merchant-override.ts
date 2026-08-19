import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";
import type { Visibility } from "@domain/enums";

export interface MerchantOverrideRow {
  id: number;
  /** The catalogue entry's stable key, e.g. "carrefour". */
  merchantKey: string;
  /** Re-pointed here; `null` means the kind's default category still applies. */
  categoryId: number | null;
  /** Switched off: the shipped entry stops matching. */
  disabled: boolean;
  ownerId: number | null;
  visibility: Visibility;
  createdAt: Date;
}

export type NewMerchantOverride = Omit<MerchantOverrideRow, "id" | "createdAt">;

/**
 * The user's word over ours about a shipped merchant.
 *
 * Kept as a small row rather than by editing a copy of the catalogue: an
 * override says *what you changed*, so everything you did not change keeps
 * improving as the catalogue does, and "revenir au défaut" is a delete rather
 * than an attempt to remember what we used to ship.
 */
export class MerchantOverride extends Entity<MerchantOverrideRow> {
  private constructor(row: MerchantOverrideRow) {
    super(row);
  }

  static reconstitute(row: MerchantOverrideRow): MerchantOverride {
    return new MerchantOverride(row);
  }

  static create(input: NewMerchantOverride): MerchantOverride {
    invariant(
      input.merchantKey.trim().length > 0,
      "Le marchand est obligatoire.",
      "merchant_override.key_required",
    );
    // Neither re-pointed nor switched off is not an override, it is a no-op
    // row that would quietly shadow a future catalogue fix.
    invariant(
      input.disabled || input.categoryId !== null,
      "Un réglage doit changer la catégorie ou désactiver le marchand.",
      "merchant_override.empty",
    );
    return new MerchantOverride({ ...input, id: 0, createdAt: new Date() });
  }

  get merchantKey(): string {
    return this.row.merchantKey;
  }
}
