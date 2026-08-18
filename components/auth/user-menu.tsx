"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { App, Avatar, Button, Dropdown, Typography } from "antd";
import { LockOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

export type CurrentUser = { id: number; name: string; role: "owner" | "member" } | null;

/**
 * Who is signed in, and the way out.
 *
 * Lives in the sidebar footer, so its trigger is styled for the dark surface
 * rather than inheriting the page's text colour — antd's `type="text"` button
 * would otherwise render near-black on near-black.
 *
 * In open mode there is no session to end, so the menu says so instead of
 * offering a logout that would do nothing; the owner gets the prompt to turn
 * authentication on, which is the only action that matters there.
 */
export function UserMenu({
  user,
  authMode,
  collapsed = false,
}: {
  user: CurrentUser;
  authMode: "open" | "enforced";
  collapsed?: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  if (!user) return null;

  const open = authMode === "open";

  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (!res.ok) {
      message.error("Échec de la déconnexion");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <Dropdown
      trigger={["click"]}
      placement="topLeft"
      menu={{
        items: [
          {
            key: "who",
            disabled: true,
            label: (
              <div style={{ paddingBlock: 4 }}>
                <Text strong style={{ display: "block" }}>
                  {user.name}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {user.role === "owner" ? "Propriétaire" : "Membre"}
                  {open && " · sans connexion"}
                </Text>
              </div>
            ),
          },
          { type: "divider" },
          {
            key: "settings",
            icon: <SettingOutlined />,
            label: <Link href="/parametres">Paramètres</Link>,
          },
          open
            ? {
                key: "enable",
                icon: <LockOutlined />,
                label: <Link href="/parametres">Activer la confidentialité</Link>,
              }
            : { key: "logout", icon: <LogoutOutlined />, label: "Se déconnecter", onClick: logout },
        ],
      }}
    >
      <Button
        type="text"
        aria-label={`Compte de ${user.name}`}
        style={{
          color: "rgba(255,255,255,0.85)",
          paddingInline: collapsed ? 0 : 6,
          minWidth: collapsed ? 32 : undefined,
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: "100%",
        }}
      >
        <Avatar size={24} icon={<UserOutlined />} />
        {!collapsed && (
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 13,
            }}
          >
            {user.name}
            {open && (
              <span style={{ opacity: 0.6 }}> · ouvert</span>
            )}
          </span>
        )}
      </Button>
    </Dropdown>
  );
}
