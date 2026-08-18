/**
 * The NextBudget palettes — one source of truth for chrome, charts and status.
 *
 * Two are shipped: `bleu` (cool, the one the tirelire logo was drawn for) and
 * `chaleur` (warm). They share the same eight validated hues and differ in
 * their chrome and in the slot order.
 *
 * Every value here was checked with a colour-vision validator rather than
 * chosen by eye, and three findings shaped the result:
 *
 *  1. **Slot order is the safety mechanism, not decoration.** Adjacent slots
 *     are the pairs a stacked bar or a legend puts side by side, so the order
 *     is what the colour-vision gate actually tests. Candidate orderings were
 *     enumerated and only those clearing every gate in *both* modes kept.
 *     `chaleur` is `bleu` with slots 1 and 2 swapped — one of the passing
 *     orders, not a free choice.
 *
 *  2. **Wong / Okabe-Ito was rejected**, despite being the usual recommendation.
 *     Its yellow sits at lightness 0.90 (contrast 1.29 on a light surface): it
 *     was designed for print figures with outlined markers, not for fills on a
 *     near-white UI. Uniform-lightness ramps were rejected too — at one
 *     lightness, hue alone cannot separate the deutan-confusable pairs, and no
 *     ordering of eight passes.
 *
 *  3. **The income/expense pair fails colour-vision separation** at ΔE 4.1 for
 *     deuteranopes, and no restepping fixes it: red against green *is* the
 *     confusable pair. It is kept because it reads instantly for everyone else,
 *     but it is only ever reinforcement — see `MONEY_ENCODING_RULE`.
 */

export type PaletteName = "bleu" | "chaleur";

export type Palette = {
  /** Interactive colour: buttons, links, focus. Clears 4.5:1 against white. */
  primary: string;
  /** The deep brand surface — sidebar, headings. */
  ink: string;
  /** Categorical series colours in fixed slot order, per mode. */
  series: { light: readonly string[]; dark: readonly string[] };
};

/**
 * Chart surfaces the palettes were validated against. A chart drawn on a
 * different background invalidates the contrast results.
 */
export const SURFACE = {
  light: "#fcfcfb",
  dark: "#1a1a19",
} as const;

export const PALETTES: Record<PaletteName, Palette> = {
  // Blue-led. Slot 1 is close to the logo blue, so the first series and the
  // brand agree without the chrome and the data looking like the same thing.
  bleu: {
    primary: "#1D6EF2",
    ink: "#0E2348",
    series: {
      light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
      dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
    },
  },
  // Warm-led. Terracotta chrome over a warm ink; the series order is the blue
  // one with its first two slots swapped, which is itself a validated order.
  chaleur: {
    primary: "#C2410C",
    ink: "#3A2317",
    series: {
      light: ["#eb6834", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
      dark: ["#d95926", "#3987e5", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
    },
  },
};

export const DEFAULT_PALETTE: PaletteName = "bleu";

/**
 * Status colours. Fixed — never themed, and never reused as a ninth series
 * colour, or a warning and a category would look like the same thing.
 */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Income adds to what you have; expense takes from it. */
export const MONEY = {
  income: STATUS.good,
  expense: STATUS.critical,
} as const;

/**
 * The rule that falls out of the validator: colour is redundant here.
 *
 * Roughly one man in twelve cannot separate this green from this red, so a
 * figure whose only clue is its colour is unreadable to them. Amounts are
 * already stored signed, so the sign is free and always present — keep it, and
 * add a word or an arrow wherever the figure stands alone.
 */
export const MONEY_ENCODING_RULE =
  "Income/expense colour is reinforcement only — always keep the sign, and add an arrow or a label where the figure stands alone.";

/**
 * Series colour for slot `i`, folding anything past the eighth into the last
 * slot. A ninth generated hue would not have been validated against the other
 * eight; charts should group the tail into "Autres" before reaching here.
 */
export function seriesColor(palette: Palette, mode: "light" | "dark", i: number): string {
  const ramp = palette.series[mode];
  return ramp[Math.min(i, ramp.length - 1)];
}
