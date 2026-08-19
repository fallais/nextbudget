import type { MerchantEntry } from "@domain/services/merchant-catalog";
import { FOOD } from "./food";
import { HOME } from "./home";
import { LIFE } from "./life";
import { MOBILITY } from "./mobility";
import { MONEY } from "./money";
import { SHOPPING } from "./shopping";

/**
 * The shipped merchant catalogue.
 *
 * Reference data about the outside world, which is why it sits in
 * infrastructure rather than in the domain: it changes when a chain rebrands
 * or when the app crosses a border, never when the rules of budgeting change.
 * `@domain/services/merchant-catalog` says what an entry *is*; this says who.
 *
 * Contributing
 * ------------
 * Add nationally or internationally recognised merchants. Hyper-local shops
 * and anything personal belong in your own install, as a rule on the
 * Catégories page — a rule you write always beats an entry we ship.
 *
 * Write the distinctive root of the label, upper case: matching happens
 * against the normalised description, and the longest match wins, so
 * "CARREFOUR" already covers CARREFOUR CITY without a second pattern.
 * Reach for `regex` only where a substring cannot express it — a short name
 * that lives inside longer words needs `\\bBUT\\b`, not "BUT".
 */
export const MERCHANT_CATALOG: MerchantEntry[] = [
  ...FOOD,
  ...MOBILITY,
  ...HOME,
  ...SHOPPING,
  ...LIFE,
  ...MONEY,
];

export { FOOD, HOME, LIFE, MOBILITY, MONEY, SHOPPING };
