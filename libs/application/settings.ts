import "server-only";
import { settings } from "@infrastructure/persistence/repositories";
import type { SettingsRepository } from "@domain/repositories";

/**
 * App configuration lives in the `settings` table and is edited from the UI,
 * not from a config file or env var — same call as `authMode`. Env stays for
 * deployment facts the app cannot discover for itself (DATABASE_URL, TZ);
 * these are household facts that change during normal use, by whoever is
 * sitting in front of the app.
 */

/** `solo` hides couple-specific UI; `couple` surfaces it. */
export type HouseholdMode = "solo" | "couple";

export type SettingsDeps = { settings: SettingsRepository };

const LIVE: SettingsDeps = { settings };

export async function getHouseholdMode(deps: SettingsDeps = LIVE): Promise<HouseholdMode> {
  return (await deps.settings.get("household")) === "couple" ? "couple" : "solo";
}

export async function setHouseholdMode(
  mode: HouseholdMode,
  deps: SettingsDeps = LIVE,
): Promise<void> {
  await deps.settings.set("household", mode);
}
