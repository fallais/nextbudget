"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Statistic,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { CategoryRow, FixedExpenseRow } from "@domain/entities";
import type { FixedExpenseStatus, FixedExpensesSummary } from "@application/fixed-expenses";

const { Title, Text } = Typography;

/** Each state gets a word as well as a colour — never the dot alone. */
const STATE = {
  paid: { label: "Payé", color: STATUS.good },
  pending: { label: "À venir", color: STATUS.warning },
  overdue: { label: "En retard", color: STATUS.critical },
  anomaly: { label: "Montant inhabituel", color: STATUS.serious },
} as const;

type FormValues = {
  name: string;
  categoryId: number | null;
  expectedAmount: number;
  dueDay: number | null;
  matchPattern: string;
  tolerancePct: number;
};

/**
 * Recurring charges, as a table.
 *
 * Ordered by what needs attention — overdue, then anomalies, then still to
 * come — rather than by due day: the point of the page is the exceptions, and
 * a calendar order buries them among the ones already settled.
 */
export function FixedExpensesView({
  statuses,
  summary,
  categories,
}: {
  statuses: FixedExpenseStatus[];
  summary: FixedExpensesSummary;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState<FixedExpenseRow | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openForm(fx: FixedExpenseRow | null) {
    setEditing(fx);
    form.setFieldsValue({
      name: fx?.name ?? "",
      categoryId: fx?.categoryId ?? null,
      expectedAmount: fx ? fx.expectedAmountCents / 100 : 0,
      dueDay: fx?.dueDay ?? null,
      matchPattern: fx?.matchPattern ?? "",
      tolerancePct: fx?.tolerancePct ?? 10,
    });
    setOpen(true);
  }

  async function submit(values: FormValues) {
    setSaving(true);
    try {
      const body = {
        name: values.name,
        categoryId: values.categoryId ?? null,
        expectedAmountCents: Math.round(values.expectedAmount * 100),
        dueDay: values.dueDay ?? null,
        matchPattern: values.matchPattern,
        matchType: "contains" as const,
        tolerancePct: values.tolerancePct,
        isActive: true,
      };
      const res = await fetch(
        editing ? `/api/fixed-expenses/${editing.id}` : "/api/fixed-expenses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(data?.error ?? "Échec de l'enregistrement");
        return;
      }
      message.success(editing ? "Modifié" : "Ajouté");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(fx: FixedExpenseRow) {
    const res = await fetch(`/api/fixed-expenses/${fx.id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    message.success("Supprimé");
    router.refresh();
  }

  const rank = { overdue: 0, anomaly: 1, pending: 2, paid: 3 } as const;
  const rows = [...statuses].sort((a, b) => rank[a.state] - rank[b.state]);

  const columns: ColumnsType<FixedExpenseStatus> = [
    {
      title: "Charge",
      render: (_, s) => (
        <Flex align="center" gap={8}>
          <Badge color={STATE[s.state].color} />
          <span>{s.fixedExpense.name}</span>
        </Flex>
      ),
    },
    {
      title: "État",
      width: 170,
      render: (_, s) => <Text type="secondary">{STATE[s.state].label}</Text>,
    },
    {
      title: "Catégorie",
      width: 160,
      responsive: ["lg"],
      render: (_, s) => <Text type="secondary">{s.category?.name ?? "—"}</Text>,
    },
    {
      title: "Échéance",
      width: 100,
      responsive: ["md"],
      render: (_, s) => (
        <Text type="secondary">{s.fixedExpense.dueDay ? `le ${s.fixedExpense.dueDay}` : "—"}</Text>
      ),
    },
    {
      title: "Attendu",
      align: "right",
      width: 120,
      render: (_, s) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(s.fixedExpense.expectedAmountCents)}
        </Text>
      ),
    },
    {
      title: "Payé",
      align: "right",
      width: 120,
      render: (_, s) => (
        <Text
          style={{ fontVariantNumeric: "tabular-nums" }}
          type={s.state === "paid" ? undefined : "secondary"}
        >
          {s.paidAmountCents ? formatCents(s.paidAmountCents) : "—"}
        </Text>
      ),
    },
    {
      title: "",
      width: 80,
      align: "right",
      render: (_, s) => (
        <Flex gap={2} justify="flex-end">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openForm(s.fixedExpense)}
            aria-label={`Modifier ${s.fixedExpense.name}`}
          />
          <Popconfirm
            title={`Supprimer « ${s.fixedExpense.name} » ?`}
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={() => remove(s.fixedExpense)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Frais fixes
          </Title>
          <Text type="secondary">
            Les dépenses récurrentes attendues chaque mois — loyer, énergie, abonnements.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
          Ajouter
        </Button>
      </Flex>

      {summary.total > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Suivies" value={summary.total} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Attendu" value={formatCents(summary.expectedTotalCents)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Payé"
                value={formatCents(summary.paidTotalCents)}
                valueStyle={{ color: STATUS.good }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Reste à payer"
                value={formatCents(Math.max(0, summary.expectedTotalCents - summary.paidTotalCents))}
                valueStyle={{ color: summary.overdue > 0 ? STATUS.critical : undefined }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey={(s) => s.fixedExpense.id}
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                description="Aucune charge fixe enregistrée"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? "Modifier la charge" : "Nouvelle charge fixe"}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ paddingTop: 8 }}>
          <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Loyer" />
          </Form.Item>
          <Form.Item
            name="matchPattern"
            label="Motif de rapprochement"
            tooltip="Le texte cherché dans le libellé des transactions pour retrouver ce paiement."
            rules={[{ required: true, message: "Motif requis" }]}
          >
            <Input placeholder="EDF" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="expectedAmount"
                label="Montant attendu"
                rules={[{ required: true, message: "Montant requis" }]}
              >
                <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dueDay" label="Jour d'échéance">
                <InputNumber style={{ width: "100%" }} min={1} max={31} placeholder="5" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="categoryId" label="Catégorie">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Aucune"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tolerancePct"
                label="Tolérance"
                tooltip="Au-delà de cet écart, le montant est signalé comme inhabituel."
              >
                <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Flex>
  );
}
