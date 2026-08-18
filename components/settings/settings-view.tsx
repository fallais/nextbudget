"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, LockOutlined, PlusOutlined } from "@ant-design/icons";
import { formatCents } from "@shared/format";
import type { AccountRow } from "@domain/entities";
import type { HouseholdMode } from "@application/settings";

const { Title, Text } = Typography;

export type SettingsMember = {
  id: number;
  name: string;
  userId: number | null;
  email: string | null;
};

export type SettingsAccount = AccountRow & { txCount: number };

/**
 * Configuration, in three tabs.
 *
 * Accounts live here rather than in the sidebar: naming a bank account is
 * something you do once, not something you visit while looking at your money.
 */
export function SettingsView({
  household,
  authMode,
  members,
  accounts,
  isOwner,
}: {
  household: HouseholdMode;
  authMode: "open" | "enforced";
  members: SettingsMember[];
  accounts: SettingsAccount[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [accountForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [accountOpen, setAccountOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      message.error(data?.error ?? "Échec de l'opération");
      return false;
    }
    router.refresh();
    return true;
  }

  const accountColumns: ColumnsType<SettingsAccount> = [
    { title: "Nom", dataIndex: "name" },
    { title: "Banque", dataIndex: "bank", render: (b: string | null) => b ?? "—" },
    {
      title: "Type",
      dataIndex: "kind",
      width: 130,
      render: (k: string) => (k === "joint" ? <Tag color="blue">Commun</Tag> : <Tag>Personnel</Tag>),
    },
    {
      title: "Transactions",
      dataIndex: "txCount",
      width: 130,
      align: "right",
      render: (n: number) => <Text type="secondary">{n.toLocaleString("fr-FR")}</Text>,
    },
    {
      title: "",
      width: 50,
      align: "right",
      render: (_, a) => (
        <Popconfirm
          title={`Supprimer « ${a.name} » ?`}
          description={
            a.txCount > 0
              ? "Ce compte contient des transactions — la suppression sera refusée."
              : undefined
          }
          okText="Supprimer"
          cancelText="Annuler"
          onConfirm={() => send(`/api/accounts/${a.id}`, "DELETE")}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Flex vertical gap={16} style={{ maxWidth: 1100 }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Paramètres
        </Title>
        <Text type="secondary">Composition du foyer, comptes bancaires et confidentialité.</Text>
      </div>

      <Tabs
        defaultActiveKey="foyer"
        items={[
          {
            key: "foyer",
            label: "Foyer",
            children: (
              <Flex vertical gap={16}>
                <Card size="small" title="Mode">
                  <Segmented
                    value={household}
                    disabled={!isOwner}
                    onChange={(v) => send("/api/settings", "PATCH", { household: v })}
                    options={[
                      { value: "solo", label: "Solo" },
                      { value: "couple", label: "Couple" },
                    ]}
                  />
                  <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                    En solo, les fonctionnalités de couple (quotes-parts, apports) restent masquées.
                  </Text>
                </Card>

                <Card size="small" title={`Membres (${members.length})`}>
                  <Flex vertical gap={8}>
                    {members.map((m) => (
                      <Flex key={m.id} justify="space-between" align="center">
                        <Text>{m.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {m.email ?? (m.userId ? "compte lié" : "sans connexion")}
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                </Card>
              </Flex>
            ),
          },
          {
            key: "comptes",
            label: "Comptes",
            children: (
              <Flex vertical gap={12}>
                <Flex justify="space-between" align="center">
                  <Text type="secondary">
                    Chaque personne peut avoir le sien, et le foyer un compte commun sur lequel
                    arrivent les apports.
                  </Text>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      accountForm.setFieldsValue({
                        name: "",
                        bank: "",
                        kind: "personal",
                        currency: "EUR",
                      });
                      setAccountOpen(true);
                    }}
                  >
                    Ajouter
                  </Button>
                </Flex>
                <Card size="small" styles={{ body: { padding: 0 } }}>
                  <Table
                    rowKey="id"
                    size="small"
                    columns={accountColumns}
                    dataSource={accounts}
                    pagination={false}
                    locale={{ emptyText: "Aucun compte" }}
                  />
                </Card>
              </Flex>
            ),
          },
          {
            key: "confidentialite",
            label: "Confidentialité",
            children: (
              <Flex vertical gap={12}>
                <Alert
                  type={authMode === "enforced" ? "success" : "info"}
                  showIcon
                  message={
                    authMode === "enforced"
                      ? "Chacun son espace (connexion requise)"
                      : "Tout partagé (sans connexion)"
                  }
                  description={
                    authMode === "enforced"
                      ? "Chaque membre voit ses données et celles marquées comme partagées."
                      : "Tout le monde voit tout. Aucun mot de passe n'est demandé."
                  }
                  action={
                    authMode === "open" &&
                    isOwner && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<LockOutlined />}
                        onClick={() => {
                          authForm.setFieldsValue({ email: "", password: "" });
                          setAuthOpen(true);
                        }}
                      >
                        Activer
                      </Button>
                    )
                  }
                />
                {authMode === "enforced" && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Mot de passe oublié ? Depuis le serveur : <Text code>npm run auth:reset</Text>
                  </Text>
                )}
              </Flex>
            ),
          },
        ]}
      />

      <Modal
        open={accountOpen}
        title="Nouveau compte"
        onCancel={() => setAccountOpen(false)}
        onOk={() => accountForm.submit()}
        confirmLoading={busy}
        okText="Créer"
        cancelText="Annuler"
      >
        <Form
          form={accountForm}
          layout="vertical"
          style={{ paddingTop: 8 }}
          onFinish={async (v) => {
            setBusy(true);
            try {
              if (await send("/api/accounts", "POST", { ...v, visibility: "shared" })) {
                setAccountOpen(false);
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Compte courant" />
          </Form.Item>
          <Form.Item name="bank" label="Banque">
            <Input placeholder="Crédit Mutuel" />
          </Form.Item>
          <Form.Item
            name="kind"
            label="Type"
            tooltip="Les apports ne sont rapprochés que sur les comptes communs."
          >
            <Segmented
              options={[
                { value: "personal", label: "Personnel" },
                { value: "joint", label: "Commun" },
              ]}
            />
          </Form.Item>
          <Form.Item name="currency" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={authOpen}
        title="Activer la confidentialité"
        onCancel={() => setAuthOpen(false)}
        onOk={() => authForm.submit()}
        confirmLoading={busy}
        okText="Activer"
        cancelText="Annuler"
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Une connexion sera exigée après cette étape."
          description="Vous restez connecté immédiatement, donc aucun risque de blocage."
        />
        <Form
          form={authForm}
          layout="vertical"
          onFinish={async (v) => {
            setBusy(true);
            try {
              if (await send("/api/auth/setup", "POST", v)) setAuthOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item name="email" label="Email (facultatif)">
            <Input type="email" placeholder="vous@exemple.fr" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true, min: 8, message: "8 caractères minimum" }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}

export { formatCents };
