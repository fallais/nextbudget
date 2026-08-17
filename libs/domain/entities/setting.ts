/**
 * App configuration, keyed by name: `authMode`, `household`.
 *
 * Configuration that changes during normal use lives here rather than in env
 * vars, so it can be edited from the UI by whoever is using the app.
 */
export interface SettingRow {
  key: string;
  value: unknown | null;
}
