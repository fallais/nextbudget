import "server-only";
import { getDataSource } from "./client";
import { SettingEntity } from "./entities";

/**
 * App configuration lives in the `settings` table and is edited from the UI,
 * not from a config file or env var — same call as `authMode`. Env stays for
 * deployment facts the app cannot discover for itself (DATABASE_URL, TZ);
 * these are household facts that change during normal use, by whoever is
 * sitting in front of the app.
 */

/** `solo` hides couple-specific UI; `couple` surfaces it. */
export type HouseholdMode = "solo" | "couple";

export async function getHouseholdMode(): Promise<HouseholdMode> {
  const ds = await getDataSource();
  const row = await ds.getRepository(SettingEntity).findOne({ where: { key: "household" } });
  return row?.value === "couple" ? "couple" : "solo";
}

export async function setHouseholdMode(mode: HouseholdMode): Promise<void> {
  const ds = await getDataSource();
  // settings.key is the PK → save upserts.
  await ds.getRepository(SettingEntity).save({ key: "household", value: mode });
}
