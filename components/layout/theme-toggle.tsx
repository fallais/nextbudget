"use client";

import { useEffect, useState } from "react";
import { Button, Tooltip } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";

/**
 * Light/dark toggle.
 *
 * Renders a placeholder until mounted: the resolved theme is unknown on the
 * server, and showing the wrong icon for one frame is a visible flicker on
 * every page load.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <Tooltip title={dark ? "Passer en clair" : "Passer en sombre"}>
      <Button
        type="text"
        aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
        icon={mounted ? dark ? <SunOutlined /> : <MoonOutlined /> : <span style={{ width: 14 }} />}
        onClick={() => setTheme(dark ? "light" : "dark")}
      />
    </Tooltip>
  );
}
