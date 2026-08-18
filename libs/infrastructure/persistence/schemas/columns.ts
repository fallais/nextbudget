import type { ValueTransformer } from "typeorm";

/**
 * Column fragments shared by the EntitySchemas in this folder.
 *
 * These exist so the same decision is not restated fifteen times: what a
 * primary key looks like, how `created_at` is filled, and which two columns
 * every scoped table carries.
 */

// Postgres returns bigint (int8) and numeric as strings. Store money as bigint
// (safe for net-worth/mortgage sizes) but expose it as a JS number.
export const bigintNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? v : Number(v)),
};

export const id = { type: Number, primary: true, generated: "increment" as const };

export const createdAt = {
  name: "created_at",
  type: "timestamptz" as const,
  createDate: true,
};

/** The two columns `libs/application/scope.ts` filters on. Spread into a table. */
export const owner = {
  ownerId: { name: "owner_id", type: Number, nullable: true },
  visibility: { type: "text" as const, default: "shared" },
};
