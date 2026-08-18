"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  ColorPicker,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { formatCents } from "@shared/format";
import type { CategoryRow, RuleRow } from "@domain/entities";

const { Title, Text } = Typography;

const MATCH_LABELS: Record<string, string> = {
  contains: "contient",
  equals: "est exactement",
  starts_with: "commence par",
  regex: "expression régulière",
};

/**
 * Categories and the rules that fill them.
 *
 * Two panes: pick a category on the left, work on its rules on the right.
 * Rules only make sense against the category they file into, so showing every
 * rule in one flat list would lose the thing that gives them meaning.
 */
export function CategoriesView({
  categories,
  rulesByCategory,
}: {
  categories: CategoryRow[];
  rulesByCategory: Record<number, RuleRow[]>;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [selectedId, setSelectedId] = useState<number | null>(categories[0]?.id ?? null);
  const [catForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [catOpen, setCatOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);

  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const rules = selectedId ? (rulesByCategory[selectedId] ?? []) : [];

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

  async function recategorize() {
    setRecategorizing(true);
    try {
      const res = await fetch("/api/recategorize", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { updated?: number } | null;
      if (!res.ok) {
        message.error("Échec du reclassement");
        return;
      }
      message.success(`${data?.updated ?? 0} transaction(s) reclassée(s)`);
      router.refresh();
    } finally {
      setRecategorizing(false);
    }
  }

  const ruleColumns: ColumnsType<RuleRow> = [
    {
      title: "Règle",
      render: (_, r) => (
        <Text>
          <Text type="secondary">{MATCH_LABELS[r.matchType] ?? r.matchType}</Text>{" "}
          <Text code>{r.pattern}</Text>
        </Text>
      ),
    },
    {
      title: "Montant",
      width: 120,
      render: (_, r) =>
        r.amountCondition === "any" ? (
          <Text type="secondary">—</Text>
        ) : (
          <Tag>{r.amountCondition === "positive" ? "crédits" : "débits"}</Tag>
        ),
    },
    { title: "Priorité", dataIndex: "priority", width: 90, align: "right" },
    {
      title: "",
      width: 50,
      align: "right",
      render: (_, r) => (
        <Popconfirm
          title="Supprimer cette règle ?"
          okText="Supprimer"
          cancelText="Annuler"
          onConfirm={() => send(`/api/rules/${r.id}`, "DELETE")}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Catégories
          </Title>
          <Text type="secondary">
            Vos catégories et les règles qui classent les transactions automatiquement.
          </Text>
        </div>
        <Flex gap={8}>
          <Button
            icon={<ThunderboltOutlined />}
            loading={recategorizing}
            onClick={recategorize}
          >
            Reclasser tout
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCat(null);
              catForm.setFieldsValue({ name: "", color: "#6b7280", icon: "Tag" });
              setCatOpen(true);
            }}
          >
            Catégorie
          </Button>
        </Flex>
      </Flex>

      <Flex gap={16} align="flex-start" wrap>
        <Card
          size="small"
          title={`Catégories (${categories.length})`}
          style={{ width: 280, flexShrink: 0 }}
          styles={{ body: { padding: 0, maxHeight: 560, overflow: "auto" } }}
        >
          <List
            size="small"
            dataSource={categories}
            locale={{ emptyText: "Aucune catégorie" }}
            renderItem={(c) => (
              <List.Item
                onClick={() => setSelectedId(c.id)}
                style={{
                  cursor: "pointer",
                  paddingInline: 12,
                  background: c.id === selectedId ? "rgba(128,128,128,0.12)" : undefined,
                }}
              >
                <Flex align="center" gap={8} style={{ width: "100%", minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }}
                  />
                  <Text ellipsis style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {(rulesByCategory[c.id] ?? []).length}
                  </Text>
                </Flex>
              </List.Item>
            )}
          />
        </Card>

        <Card
          size="small"
          style={{ flex: 1, minWidth: 320 }}
          title={selected ? `Règles · ${selected.name}` : "Règles"}
          extra={
            selected && (
              <Flex gap={4}>
                <Button
                  size="small"
                  onClick={() => {
                    setEditingCat(selected);
                    catForm.setFieldsValue({
                      name: selected.name,
                      color: selected.color,
                      icon: selected.icon,
                    });
                    setCatOpen(true);
                  }}
                >
                  Renommer
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    ruleForm.setFieldsValue({
                      pattern: "",
                      matchType: "contains",
                      amountCondition: "any",
                      priority: 100,
                    });
                    setRuleOpen(true);
                  }}
                >
                  Règle
                </Button>
              </Flex>
            )
          }
          styles={{ body: { padding: 0 } }}
        >
          {selected ? (
            <Table
              rowKey="id"
              size="small"
              columns={ruleColumns}
              dataSource={rules}
              pagination={false}
              locale={{ emptyText: "Aucune règle — cette catégorie ne se remplira pas toute seule" }}
            />
          ) : (
            <div style={{ padding: 24 }}>
              <Empty description="Choisissez une catégorie" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </Card>
      </Flex>

      <Modal
        open={catOpen}
        title={editingCat ? "Modifier la catégorie" : "Nouvelle catégorie"}
        onCancel={() => setCatOpen(false)}
        onOk={() => catForm.submit()}
        confirmLoading={busy}
        okText="Enregistrer"
        cancelText="Annuler"
        footer={(_, { OkBtn, CancelBtn }) => (
          <Flex justify="space-between">
            {editingCat ? (
              <Popconfirm
                title={`Supprimer « ${editingCat.name} » ?`}
                description="Ses règles et budgets seront supprimés ; les transactions deviendront non catégorisées."
                okText="Supprimer"
                cancelText="Annuler"
                onConfirm={async () => {
                  if (await send(`/api/categories/${editingCat.id}`, "DELETE")) {
                    setCatOpen(false);
                    setSelectedId(null);
                  }
                }}
              >
                <Button danger type="text">
                  Supprimer
                </Button>
              </Popconfirm>
            ) : (
              <span />
            )}
            <Flex gap={8}>
              <CancelBtn />
              <OkBtn />
            </Flex>
          </Flex>
        )}
      >
        <Form
          form={catForm}
          layout="vertical"
          style={{ paddingTop: 8 }}
          onFinish={async (v: { name: string; color: string | { toHexString(): string }; icon: string }) => {
            setBusy(true);
            try {
              const color = typeof v.color === "string" ? v.color : v.color.toHexString();
              const ok = editingCat
                ? await send(`/api/categories/${editingCat.id}`, "PATCH", { ...v, color })
                : await send("/api/categories", "POST", { ...v, color });
              if (ok) setCatOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Alimentation" />
          </Form.Item>
          <Form.Item name="color" label="Couleur">
            <ColorPicker format="hex" disabledAlpha showText />
          </Form.Item>
          <Form.Item name="icon" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={ruleOpen}
        title={selected ? `Nouvelle règle · ${selected.name}` : ""}
        onCancel={() => setRuleOpen(false)}
        onOk={() => ruleForm.submit()}
        confirmLoading={busy}
        okText="Ajouter"
        cancelText="Annuler"
      >
        <Form
          form={ruleForm}
          layout="vertical"
          style={{ paddingTop: 8 }}
          onFinish={async (v: Record<string, unknown>) => {
            if (!selected) return;
            setBusy(true);
            try {
              const ok = await send("/api/rules", "POST", { ...v, categoryId: selected.id });
              if (ok) setRuleOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="pattern"
            label="Motif"
            rules={[{ required: true, message: "Motif requis" }]}
            tooltip="Comparé au libellé normalisé de la transaction."
          >
            <Input placeholder="CARREFOUR" />
          </Form.Item>
          <Form.Item name="matchType" label="Correspondance">
            <Select
              options={Object.entries(MATCH_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="amountCondition" label="Montant">
            <Select
              options={[
                { value: "any", label: "Peu importe" },
                { value: "negative", label: "Débits seulement" },
                { value: "positive", label: "Crédits seulement" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Priorité"
            tooltip="La règle la plus prioritaire gagne quand plusieurs correspondent."
          >
            <InputNumber min={0} max={10000} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}

export { formatCents };
