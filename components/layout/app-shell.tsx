"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, Menu, Typography } from "antd";
import {
  BankOutlined,
  CreditCardOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  PieChartOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { LogoMark } from "./logo";
import { UserMenu, type CurrentUser } from "@/components/auth/user-menu";
import { ThemeToggle } from "./theme-toggle";

const { Sider, Content } = Layout;

/**
 * Day-to-day money first, then what you own and owe, then the things you set
 * up once. Accounts are absent on purpose: naming a bank account is
 * configuration, so it lives as a tab under Paramètres.
 */
const NAV = [
  { key: "/", icon: <HomeOutlined />, label: "Tableau de bord" },
  { key: "/transactions", icon: <SwapOutlined />, label: "Transactions" },
  { key: "/budgets", icon: <PieChartOutlined />, label: "Budgets" },
  { key: "/frais-fixes", icon: <ScheduleOutlined />, label: "Frais fixes" },
  { key: "/patrimoine", icon: <BankOutlined />, label: "Patrimoine" },
  { key: "/credits", icon: <CreditCardOutlined />, label: "Crédits" },
  { key: "/apports", icon: <TeamOutlined />, label: "Apports" },
  { key: "/categories", icon: <FolderOpenOutlined />, label: "Catégories" },
  { key: "/import", icon: <UploadOutlined />, label: "Importer" },
  { key: "/parametres", icon: <SettingOutlined />, label: "Paramètres" },
];

/**
 * The app frame: one sidebar, and the page.
 *
 * There is deliberately no top bar. A header spanning the content would cost a
 * permanent horizontal band to hold two controls that are looked at rarely —
 * the theme switch and the account menu — while the pages below are dense
 * tables that want the vertical room. Both live in the sidebar footer instead,
 * where the sidebar is already paying for the space.
 */
export function AppShell({
  user,
  authMode,
  children,
}: {
  user: CurrentUser;
  authMode: "open" | "enforced";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Longest matching prefix, so /credits stays lit on a nested route while "/"
  // only matches the dashboard itself.
  const selected =
    NAV.map((n) => n.key)
      .filter((k) => (k === "/" ? pathname === "/" : pathname.startsWith(k)))
      .sort((a, b) => b.length - a.length)[0] ?? "/";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={228}
        breakpoint="lg"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Link
          href="/"
          aria-label="NextBudget"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 56,
            padding: collapsed ? "0 0 0 22px" : "0 20px",
            color: "#fff",
          }}
        >
          <LogoMark style={{ width: 24, height: 24, flexShrink: 0 }} />
          {!collapsed && (
            <Typography.Text style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
              NextBudget
            </Typography.Text>
          )}
        </Link>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          style={{ flex: 1, borderInlineEnd: 0 }}
          items={NAV.map((n) => ({ ...n, label: <Link href={n.key}>{n.label}</Link> }))}
        />

        {/* Footer: who you are, and the theme. Sits above antd's own collapse
            trigger, which occupies the very bottom of the Sider. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 4,
            padding: collapsed ? "8px 0 56px" : "8px 12px 56px",
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <UserMenu user={user} authMode={authMode} collapsed={collapsed} />
          {!collapsed && <ThemeToggle />}
        </div>
      </Sider>

      <Layout>
        <Content style={{ padding: 20 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
