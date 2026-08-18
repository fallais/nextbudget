"use client";

import { useEffect, useState } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntdApp, ConfigProvider } from "antd";
import frFR from "antd/locale/fr_FR";
import { ThemeProvider, useTheme } from "next-themes";
import { themeFor } from "@shared/theme";
import { DEFAULT_PALETTE, type PaletteName } from "@shared/palette";

/**
 * Everything the UI needs before it can render a single antd component.
 *
 * `AntdRegistry` is not optional in the App Router: antd v6 styles are
 * CSS-in-JS, and without the registry collecting them during SSR the first
 * paint arrives unstyled and then snaps into place.
 *
 * `fr_FR` is passed once here rather than per component — it is what makes
 * antd's own strings (date pickers, pagination, empty states, table filters)
 * French, which the app is throughout.
 */

function Themed({
  palette,
  children,
}: {
  palette: PaletteName;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  // next-themes cannot know the OS preference until it has run in the browser,
  // so the first render is deliberately light for everyone: picking dark and
  // being wrong flashes far harder than the reverse.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <ConfigProvider theme={themeFor(mode, palette)} locale={frFR}>
      {/* AntdApp supplies the context that message/notification/modal need in
          order to pick up this theme instead of falling back to defaults. */}
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

export function Providers({
  children,
  palette = DEFAULT_PALETTE,
}: {
  children: React.ReactNode;
  palette?: PaletteName;
}) {
  return (
    <AntdRegistry>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Themed palette={palette}>{children}</Themed>
      </ThemeProvider>
    </AntdRegistry>
  );
}
