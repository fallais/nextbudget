"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
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
  Progress,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { ContributionRow } from "@domain/entities";
import type { ContributionStatus, PersonWithStatus } from "@application/contributions";

const { Title, Text } = Typography;

const STATE = {
  received: { label: "Reçu", color: STATUS.good },
  pending: { label: "En attente", color: STATUS.warning },
  anomaly: { label: "Montant inhabituel", color: STATUS.serious },
} as const;

type Editing = { personId: number; contribution: ContributionRow | null };

/**
 * Who has paid what into the common pot this month, and what they owe it.
 *
 * One card per person, each with its own table: the question is always "is
 * this person up to date", and a single flat table of every contribution would
 * make you reassemble that yourself.
 *
 * Apports are created and edited from here rather than from Paramètres. An
 * apport is not configuration — it is a claim about money that arrives every
 * month, and the place to write it down is the page where you find out whether
 * it did.
 */
export function ApportsView({ perPerson }: { perPerson: PersonWithStatus[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

  const active = perPerson.filter((p) => p.person.isActive);

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

  function open(personId: number, contribution: ContributionRow | null) {
    setEditing({ personId, contribution });
    form.setFieldsValue({
      name: contribution?.name ?? "",
      amount: contribution ? contribution.expectedAmountCents / 100 : null,
      matchPattern: contribution?.matchPattern ?? "",
      matchType: contribution?.matchType ?? "contains",
      tolerancePct: contribution?.tolerancePct ?? 15,
    });
  }

  const columns: ColumnsType<ContributionStatus> = [
    { title: "Apport", render: (_, c) => c.contribution.name },
    {
      title: "État",
      width: 150,
      render: (_, c) => {
        const state = STATE[c.state];
        return (
          // The tag carries a word, so state never rests on colour alone.
          <Tag color={state.color} style={{ marginInlineEnd: 0 }}>
            {state.label}
          </Tag>
        );
      },
    },
    {
      title: "Attendu",
      align: "right",
      width: 110,
      render: (_, c) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(c.contribution.expectedAmountCents)}
        </Text>
      ),
    },
    {
      title: "Reçu",
      align: "right",
      width: 110,
      render: (_, c) => (
        <Text
          style={{ fontVariantNumeric: "tabular-nums" }}
          type={c.receivedCents > 0 ? undefined : "secondary"}
        >
          {c.receivedCents ? formatCents(c.receivedCents) : "—"}
        </Text>
      ),
    },
    {
      title: "",
      width: 96,
      align: "right",
      render: (_, c) => (
        <Flex justify="flex-end">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label="Modifier"
            onClick={() => open(c.contribution.personId, c.contribution)}
          />
          <Tooltip title="Mettre en pause — l'apport cesse d'être attendu chaque mois">
            <Button
              type="text"
              size="small"
              icon={<PauseCircleOutlined />}
              aria-label="Mettre en pause"
              onClick={() =>
                send(`/api/contributions/${c.contribution.id}`, "PATCH", { isActive: false })
              }
            />
          </Tooltip>
          <Popconfirm
            title={`Supprimer « ${c.contribution.name} » ?`}
            description="Les transactions ne bougent pas ; seul l'apport attendu disparaît."
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={() => send(`/api/contributions/${c.contribution.id}`, "DELETE")}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Apports
        </Title>
        <Text type="secondary">
          Les versements mensuels sur le compte commun. Une personne peut en avoir
          plusieurs — un pour le loyer, un pour l&apos;énergie.
        </Text>
      </div>

      {active.length === 0 ? (
        <Card>
          <Empty
            description="Aucune personne active. Ajoutez des membres dans Paramètres → Foyer."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {active.map((p) => {
            const pct =
              p.expectedTotalCents > 0
                ? Math.min(100, Math.round((p.receivedTotalCents / p.expectedTotalCents) * 100))
                : 0;
            const complete = p.expectedTotalCents > 0 && p.receivedTotalCents >= p.expectedTotalCents;
            return (
              <Col key={p.person.id} xs={24} xl={12}>
                <Card
                  title={p.person.name}
                  extra={
                    <Flex align="center" gap={10}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {complete ? "à jour" : "en attente"}
                      </Text>
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => open(p.person.id, null)}
                      >
                        Ajouter
                      </Button>
                    </Flex>
                  }
                >
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <Statistic
                        title="Reçu"
                        value={formatCents(p.receivedTotalCents)}
                        valueStyle={{ fontSize: 20, color: complete ? STATUS.good : undefined }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Attendu"
                        value={formatCents(p.expectedTotalCents)}
                        valueStyle={{ fontSize: 20 }}
                      />
                    </Col>
                  </Row>
                  <Progress
                    percent={pct}
                    showInfo={false}
                    size={["100%", 6]}
                    strokeColor={complete ? STATUS.good : STATUS.warning}
                  />
                  {p.contributions.length > 0 ? (
                    <Table
                      rowKey={(c) => c.contribution.id}
                      size="small"
                      columns={columns}
                      dataSource={p.contributions}
                      pagination={false}
                      style={{ marginTop: 12 }}
                    />
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Aucun apport déclaré pour cette personne.
                    </Text>
                  )}

                  {/* Paused apports are not this month's business, but they
                      have to stay reachable or pausing one would be a way of
                      losing it. */}
                  {p.inactive.length > 0 && (
                    <Flex vertical gap={6} style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        En pause ({p.inactive.length})
                      </Text>
                      {p.inactive.map((c) => (
                        <Flex key={c.id} justify="space-between" align="center">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {c.name} · {formatCents(c.expectedAmountCents)}
                          </Text>
                          <Flex>
                            <Tooltip title="Réactiver">
                              <Button
                                type="text"
                                size="small"
                                icon={<PlayCircleOutlined />}
                                aria-label="Réactiver"
                                onClick={() =>
                                  send(`/api/contributions/${c.id}`, "PATCH", { isActive: true })
                                }
                              />
                            </Tooltip>
                            <Popconfirm
                              title={`Supprimer « ${c.name} » ?`}
                              okText="Supprimer"
                              cancelText="Annuler"
                              onConfirm={() => send(`/api/contributions/${c.id}`, "DELETE")}
                            >
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                aria-label="Supprimer"
                              />
                            </Popconfirm>
                          </Flex>
                        </Flex>
                      ))}
                    </Flex>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        open={!!editing}
        title={editing?.contribution ? `Modifier « ${editing.contribution.name} »` : "Nouvel apport"}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText={editing?.contribution ? "Enregistrer" : "Créer"}
        cancelText="Annuler"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ paddingTop: 8 }}
          onFinish={async (v) => {
            if (!editing) return;
            setBusy(true);
            const body = {
              personId: editing.personId,
              name: v.name as string,
              expectedAmountCents: Math.round(((v.amount as number) ?? 0) * 100),
              matchPattern: v.matchPattern as string,
              matchType: v.matchType as string,
              tolerancePct: v.tolerancePct as number,
              isActive: true,
            };
            try {
              const ok = editing.contribution
                ? await send(`/api/contributions/${editing.contribution.id}`, "PATCH", body)
                : await send("/api/contributions", "POST", body);
              if (ok) setEditing(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
            <Input placeholder="Courses" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Montant attendu"
            rules={[{ required: true, message: "Montant requis" }]}
          >
            <InputNumber style={{ width: "100%" }} min={0.01} step={10} addonAfter="€" />
          </Form.Item>
          <Form.Item
            name="matchPattern"
            label="Libellé à reconnaître"
            rules={[{ required: true, message: "Libellé requis" }]}
            tooltip="Cherché dans le libellé des virements reçus sur le compte commun, accents et casse ignorés."
          >
            <Input placeholder="DE FRANCOIS - COURSES" />
          </Form.Item>
          <Form.Item name="matchType" label="Correspondance">
            <Select
              options={[
                { value: "contains", label: "Contient" },
                { value: "starts_with", label: "Commence par" },
                { value: "regex", label: "Expression régulière" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="tolerancePct"
            label="Tolérance"
            tooltip="De combien le versement peut s'écarter du montant attendu avant d'être signalé comme inhabituel."
          >
            <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
