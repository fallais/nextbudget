"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { formatCents } from "@shared/format";
import { CategoryForm } from "./category-form";
import { MerchantsPanel } from "./merchants-panel";
import type { CategoryRow, RuleRow } from "@domain/entities";
import type { MerchantView } from "@application/categorize/merchants";

const { Text } = Typography;

const MATCH_LABELS: Record<string, string> = {
  contains: "contient",
  equals: "est exactement",
  starts_with: "commence par",
  regex: "expression régulière",
};

type RuleValues = {
  pattern: string;
  matchType: "contains" | "equals" | "starts_with" | "regex";
  amountCondition: "any" | "positive" | "negative";
  priority: number;
};

/**
 * One category in full: what you told the app about it, then what the app
 * already knew.
 *
 * Your rules come first on the page because they come first in the engine —
 * at equal priority a rule you wrote beats a merchant we ship, and seeing them
 * in that order is the shortest explanation of why.
 */
export function CategoryDetail({
  category,
  categories,
  rules,
  merchants,
  spentCents,
  transactionCount,
}: {
  category: CategoryRow;
  categories: CategoryRow[];
  rules: RuleRow[];
  merchants: MerchantView[];
  spentCents: number;
  transactionCount: number;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<RuleValues>();

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

  async function remove() {
    if (await send(`/api/categories/${category.id}`, "DELETE")) {
      message.success("Catégorie supprimée");
      router.push("/categories");
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
          <Tag bordered={false}>{r.amountCondition === "positive" ? "crédits" : "débits"}</Tag>
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
      <PageHeader
        crumbs={[{ label: "Catégories", href: "/categories" }, { label: category.name }]}
        description={`${transactionCount} transaction${transactionCount > 1 ? "s" : ""} ce mois-ci, pour ${formatCents(spentCents)} dépensés.`}
        actions={
          <Flex gap={8}>
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Modifier
            </Button>
            <Popconfirm
              title={`Supprimer « ${category.name} » ?`}
              description="Ses règles et son budget disparaissent ; les transactions deviennent non catégorisées."
              okText="Supprimer"
              cancelText="Annuler"
              onConfirm={remove}
            >
              <Button danger icon={<DeleteOutlined />}>
                Supprimer
              </Button>
            </Popconfirm>
          </Flex>
        }
      />

      <Card
        title={`Vos règles (${rules.length})`}
        extra={
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.setFieldsValue({
                pattern: "",
                matchType: "contains",
                amountCondition: "any",
                priority: 100,
              });
              setRuleOpen(true);
            }}
          >
            Ajouter une règle
          </Button>
        }
        styles={{ body: { padding: rules.length ? 0 : 24 } }}
      >
        {rules.length === 0 ? (
          <Text type="secondary">
            Aucune règle à vous. Les marchands ci-dessous suffisent souvent ; ajoutez-en une pour un
            commerce local ou un libellé qui n&apos;appartient qu&apos;à vous.
          </Text>
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={ruleColumns}
            dataSource={rules}
            pagination={false}
          />
        )}
      </Card>

      <MerchantsPanel category={category} merchants={merchants} />

      <CategoryForm open={editing} onOpenChange={setEditing} category={category} />

      <Modal
        open={ruleOpen}
        title={`Nouvelle règle · ${category.name}`}
        onCancel={() => setRuleOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText="Ajouter"
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          style={{ paddingTop: 8 }}
          onFinish={async (v: RuleValues) => {
            setBusy(true);
            try {
              const ok = await send("/api/rules", "POST", { ...v, categoryId: category.id });
              if (ok) {
                message.success("Règle ajoutée");
                setRuleOpen(false);
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="pattern"
            label="Motif"
            rules={[{ required: true, message: "Motif requis" }]}
          >
            <Input autoFocus placeholder="BOULANGERIE DU COIN" />
          </Form.Item>
          <Form.Item name="matchType" label="Comparaison">
            <Select
              options={Object.entries(MATCH_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="amountCondition" label="Montant">
            <Segmented
              options={[
                { value: "any", label: "Indifférent" },
                { value: "negative", label: "Débits" },
                { value: "positive", label: "Crédits" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Priorité"
            extra="Le plus petit gagne. 100 par défaut, comme les marchands livrés — à égalité, votre règle passe devant."
          >
            <InputNumber min={0} max={999} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
