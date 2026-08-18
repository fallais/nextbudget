"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { App, Avatar, Button, Dropdown, Tag, Typography } from "antd";
import { LockOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

export type CurrentUser = { id: number; name: string; role: "owner" | "member" } | null;

/**
 * Who is signed in, and the way out.
 *
 * In open mode there is no session to end, so the menu says so rather than
 * offering a logout that would do nothing — and the owner gets the prompt to
 * turn authentication on, which is the only action that matters there.
 */
export function UserMenu({
  user,
  authMode,
}: {
  user: CurrentUser;
  authMode: "open" | "enforced";
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
      <Button type="text" style={{ height: 40, paddingInline: 8 }}>
        <Avatar size={26} icon={<UserOutlined />} />
        <Text style={{ marginInlineStart: 8 }}>{user.name}</Text>
        {open && (
          <Tag style={{ marginInlineStart: 8, marginInlineEnd: 0 }} bordered={false}>
            ouvert
          </Tag>
        )}
      </Button>
    </Dropdown>
  );
}
