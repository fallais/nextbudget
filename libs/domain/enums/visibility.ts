/**
 * Who may see a row. Orthogonal to ownership: a share says how much of a thing
 * is yours, visibility says whether the other person can see it exists.
 */
export const VISIBILITIES = ["private", "shared"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
