/**
 * How the place actually presents, as the owner judges it.
 *
 * The one input in an estimate that is not a measurement. DVF records what
 * changed hands and for how much, never the state it was in, so no amount of
 * open data tells a gutted farmhouse from the same farmhouse rewired and
 * replastered. The estimation sites ask because nobody publishes it. So do we.
 *
 * `bon` is the neutral point rather than the middle of a scale: the median
 * comparable is an ordinary house in ordinary condition, so that is what the
 * unadjusted figure already describes.
 */
export const PROPERTY_CONDITIONS = [
  "a_renover",
  "a_rafraichir",
  "bon",
  "refait",
  "neuf",
] as const;
export type PropertyCondition = (typeof PROPERTY_CONDITIONS)[number];

export const PROPERTY_CONDITION_LABELS: Record<PropertyCondition, string> = {
  a_renover: "À rénover",
  a_rafraichir: "À rafraîchir",
  bon: "Bon état",
  refait: "Refait à neuf",
  neuf: "Neuf",
};
