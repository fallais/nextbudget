import "server-only";
import { merchantOverrides } from "@infrastructure/persistence/repositories";
import { MERCHANT_CATALOG } from "@infrastructure/categorize/catalog";
import { MERCHANT_KIND_CATEGORY, MERCHANT_KIND_LABELS, type MerchantKind } from "@domain/enums";
import { invariant } from "@domain/errors";
import { resolveCatalog } from "./engine";

/** One catalogue entry as the Marchands screen needs it. */
export type MerchantView = {
  key: string;
  name: string;
  kind: MerchantKind;
  kindLabel: string;
  /** Every pattern, regex included, for the "why did this match" column. */
  patterns: string[];
  categoryId: number | null;
  defaultCategoryId: number | null;
  defaultCategoryName: string;
  overridden: boolean;
  disabled: boolean;
};

export async function listMerchants(): Promise<MerchantView[]> {
  const resolved = await resolveCatalog();
  return resolved
    .map((m) => ({
      key: m.entry.key,
      name: m.entry.name,
      kind: m.entry.kind,
      kindLabel: MERCHANT_KIND_LABELS[m.entry.kind],
      patterns: [...m.entry.patterns, ...(m.entry.regex ? [m.entry.regex] : [])],
      categoryId: m.categoryId,
      defaultCategoryId: m.defaultCategoryId,
      defaultCategoryName: MERCHANT_KIND_CATEGORY[m.entry.kind],
      overridden: m.overridden,
      disabled: m.disabled,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Record what the user decided about a shipped merchant.
 *
 * Saying "no change and not disabled" is how the UI asks for the default back,
 * so it deletes rather than storing a row that says nothing — an override that
 * asserts today's shipped value would silently freeze it against tomorrow's.
 */
export async function setMerchantOverride(
  merchantKey: string,
  input: { categoryId: number | null; disabled: boolean },
  ownerId: number | null,
): Promise<void> {
  invariant(
    MERCHANT_CATALOG.some((m) => m.key === merchantKey),
    "Marchand inconnu.",
    "merchant.unknown",
  );

  if (input.categoryId === null && !input.disabled) {
    await merchantOverrides.deleteByKey(merchantKey);
    return;
  }

  const existing = await merchantOverrides.findByKey(merchantKey);
  if (existing) {
    await merchantOverrides.update(existing.id, {
      categoryId: input.categoryId,
      disabled: input.disabled,
    });
    return;
  }

  await merchantOverrides.create({
    merchantKey,
    categoryId: input.categoryId,
    disabled: input.disabled,
    ownerId,
    visibility: "shared",
  });
}

/** Back to what the catalogue says. */
export async function clearMerchantOverride(merchantKey: string): Promise<boolean> {
  return merchantOverrides.deleteByKey(merchantKey);
}
