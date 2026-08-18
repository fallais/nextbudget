"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, Menu, Typography, theme } from "antd";
import {
  AppstoreOutlined,
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

const { Sider, Header, Content } = Layout;

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
  const { token } = theme.useToken();

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
          items={NAV.map((n) => ({
            ...n,
            label: <Link href={n.key}>{n.label}</Link>,
          }))}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            paddingInline: 20,
            height: 56,
            lineHeight: "56px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <ThemeToggle />
          <UserMenu user={user} authMode={authMode} />
        </Header>
        <Content style={{ padding: 20 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

export { AppstoreOutlined };
