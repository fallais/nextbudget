import { theme as antdTheme, type ThemeConfig } from "antd";
import {
  DEFAULT_PALETTE,
  PALETTES,
  STATUS,
  SURFACE,
  type PaletteName,
} from "./palette";

/**
 * The Ant Design theme, derived from `./palette`.
 *
 * Only tokens that carry a decision are set. Everything else is left to antd's
 * algorithm on purpose: overriding tokens wholesale is how a design system
 * stops being one, and the defaults already agree with themselves.
 *
 * The shape is deliberately dense. This is a money app looked at daily, mostly
 * as tables and figures, so it trades padding for rows on screen: a shorter
 * control height and tighter cells than antd's defaults.
 */

const density = {
  controlHeight: 34,
  borderRadius: 8,
  fontSize: 14,
  sizeUnit: 4,
  sizeStep: 4,
} as const;

const components = (ink: string, mode: "light" | "dark"): ThemeConfig["components"] => ({
  // The sidebar is the one deliberately dark surface in light mode: it frames
  // the page and keeps the brand ink present without tinting the content.
  Layout: {
    siderBg: mode === "dark" ? "#111110" : ink,
    headerBg: mode === "dark" ? "#1f1f1e" : "#ffffff",
    bodyBg: SURFACE[mode],
  },
  Menu: {
    darkItemBg: mode === "dark" ? "#111110" : ink,
    darkSubMenuItemBg: mode === "dark" ? "#111110" : ink,
    darkItemSelectedBg: mode === "dark" ? "#2a2a28" : "rgba(255,255,255,0.14)",
    darkItemHoverBg: "rgba(255,255,255,0.08)",
    darkItemColor: "rgba(255,255,255,0.72)",
  },
  Card: { paddingLG: 20 },
  Table: { cellPaddingBlock: 10 },
  Statistic: { contentFontSize: 26 },
});

export function themeFor(
  mode: "light" | "dark",
  paletteName: PaletteName = DEFAULT_PALETTE,
): ThemeConfig {
  const palette = PALETTES[paletteName];
  return {
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: palette.primary,
      colorInfo: palette.primary,
      colorSuccess: STATUS.good,
      colorWarning: STATUS.warning,
      colorError: STATUS.critical,
      colorBgLayout: SURFACE[mode],
      ...(mode === "light" ? { colorTextHeading: palette.ink } : {}),
      fontFamily:
        "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      ...density,
    },
    components: components(palette.ink, mode),
  };
}
