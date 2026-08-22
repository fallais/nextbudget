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
      disabled: m.disabled,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Switch a shipped merchant off, or back on.
 *
 * Back on deletes the row rather than storing one that says nothing — an
 * override asserting today's shipped value would silently freeze it against
 * tomorrow's.
 */
export async function setMerchantOverride(
  merchantKey: string,
  input: { disabled: boolean },
  ownerId: number | null,
): Promise<void> {
  invariant(
    MERCHANT_CATALOG.some((m) => m.key === merchantKey),
    "Marchand inconnu.",
    "merchant.unknown",
  );

  if (!input.disabled) {
    await merchantOverrides.deleteByKey(merchantKey);
    return;
  }

  const existing = await merchantOverrides.findByKey(merchantKey);
  if (existing) return;

  await merchantOverrides.create({
    merchantKey,
    disabled: true,
    ownerId,
    visibility: "shared",
  });
}

