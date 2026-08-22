"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Row,
  Segmented,
  Select,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { MONEY, STATUS } from "@shared/palette";
import { formatCents, formatMonthLabel } from "@shared/format";
import type { ContributionRow } from "@domain/entities";
import type { ContributionHistory, MonthState, PersonHistory } from "@application/contributions";

const { Text } = Typography;

const ALL = "all";

const WINDOWS = [
  { value: "6", label: "6 mois" },
  { value: "12", label: "12 mois" },
  { value: "24", label: "24 mois" },
];

type Editing = { personId: number; contribution: ContributionRow | null };

/**
 * Who pays what into the common pot, and whether they have.
 *
 * Built like Crédits rather than as one card per person: an apport is a
 * standing commitment with a history, so it gets a row of its own, its figures
 * labelled beside it, and its record of the last months as a strip you can
 * read at a glance. A card per person answered "are we square this month" and
 * nothing else — the useful question is which apport quietly stopped arriving,
 * and that is invisible in a single month.
 */
export function ApportsView({
  perPerson,
  months,
}: {
  perPerson: PersonHistory[];
  months: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [scope, setScope] = useState<string>(ALL);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

  const persons = perPerson.filter((p) => p.person.isActive);
  const shown = scope === ALL ? persons : persons.filter((p) => String(p.person.id) === scope);

  const totals = useMemo(
    () => ({
      expected: shown.reduce((a, p) => a + p.expectedCents, 0),
      received: shown.reduce((a, p) => a + p.receivedCents, 0),
      missed: shown.reduce((a, p) => a + p.missedCount, 0),
    }),
    [shown],
  );

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
      personId,
      name: contribution?.name ?? "",
      amount: contribution ? contribution.expectedAmountCents / 100 : null,
      matchPattern: contribution?.matchPattern ?? "",
      matchType: contribution?.matchType ?? "contains",
      tolerancePct: contribution?.tolerancePct ?? 15,
    });
  }

  function setWindow(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("months", value);
    router.push(`/apports?${params.toString()}`);
  }

  const defaultPerson = scope === ALL ? (persons[0]?.person.id ?? 0) : Number(scope);

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Apports" }]}
        description="Les versements sur le compte commun, et ceux qui ne sont pas arrivés."
        actions={
          persons.length > 0 && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => open(defaultPerson, null)}
            >
              Ajouter un apport
            </Button>
          )
        }
      />

      {persons.length === 0 ? (
        <Card>
          <Empty
            description="Aucune personne active. Ajoutez des membres dans Paramètres → Foyer."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} lg={6}>
              <Card size="small">
                <Statistic title="Reçu" value={formatCents(totals.received)} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  sur {months} mois
                </Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card size="small">
                <Statistic title="Attendu" value={formatCents(totals.expected)} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  sur la même période
                </Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Non versés"
                  value={totals.missed}
                  valueStyle={{ color: totals.missed > 0 ? STATUS.serious : undefined }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {totals.missed > 0 ? "mois sans versement" : "aucun mois manquant"}
                </Text>
              </Card>
            </Col>
          </Row>

          <Flex justify="space-between" align="center" wrap gap={12}>
            {persons.length > 1 ? (
              <Segmented
                value={scope}
                onChange={(v) => setScope(String(v))}
                options={[
                  { value: ALL, label: "Tout le foyer" },
                  ...persons.map((p) => ({ value: String(p.person.id), label: p.person.name })),
                ]}
              />
            ) : (
              <span />
            )}
            <Segmented value={String(months)} onChange={(v) => setWindow(String(v))} options={WINDOWS} />
          </Flex>

          {shown.map((p) => (
            <Flex vertical gap={8} key={p.person.id}>
              {scope === ALL && persons.length > 1 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {p.person.name}
                </Text>
              )}
              {p.contributions.length === 0 && p.inactive.length === 0 ? (
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Aucun apport déclaré pour {p.person.name}.
                  </Text>
                </Card>
              ) : (
                p.contributions.map((c) => (
                  <ApportRow
                    key={c.contribution.id}
                    history={c}
                    onEdit={() => open(p.person.id, c.contribution)}
                    onPause={() =>
                      send(`/api/contributions/${c.contribution.id}`, "PATCH", { isActive: false })
                    }
                    onDelete={() => send(`/api/contributions/${c.contribution.id}`, "DELETE")}
                  />
                ))
              )}

              {Object.keys(p.unclaimedByMonth).length > 0 && (
                <Card size="small">
                  <Flex vertical gap={4}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Versements de {p.person.name} qu&apos;aucun apport ne réclame
                    </Text>
                    <Flex gap={16} wrap>
                      {Object.entries(p.unclaimedByMonth)
                        .sort()
                        .map(([month, cents]) => (
                          <Text key={month} style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                            {formatMonthLabel(`${month}-01`)} · {formatCents(cents)}
                          </Text>
                        ))}
                    </Flex>
                  </Flex>
                </Card>
              )}

              {p.inactive.length > 0 && (
                <Card size="small" style={{ background: token.colorFillQuaternary }}>
                  <Flex vertical gap={6}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
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
                              onClick={() => send(`/api/contributions/${c.id}`, "PATCH", { isActive: true })}
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
                </Card>
              )}
            </Flex>
          ))}
        </>
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
            setBusy(true);
            const body = {
              personId: v.personId as number,
              name: v.name as string,
              expectedAmountCents: Math.round(((v.amount as number) ?? 0) * 100),
              matchPattern: v.matchPattern as string,
              matchType: v.matchType as string,
              tolerancePct: v.tolerancePct as number,
              isActive: true,
            };
            try {
              const ok = editing?.contribution
                ? await send(`/api/contributions/${editing.contribution.id}`, "PATCH", body)
                : await send("/api/contributions", "POST", body);
              if (ok) setEditing(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="personId"
            label="Personne"
            rules={[{ required: true, message: "Personne requise" }]}
          >
            <Select options={persons.map((p) => ({ value: p.person.id, label: p.person.name }))} />
          </Form.Item>
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

/**
 * One apport: its record on the left, its figures on the right.
 *
 * The strip is the point of the row. Twelve months of "did it arrive" is a
 * shape you read in one glance, and a gap in it is the thing this page exists
 * to surface.
 */
function ApportRow({
  history,
  onEdit,
  onPause,
  onDelete,
}: {
  history: ContributionHistory;
  onEdit: () => void;
  onPause: () => void;
  onDelete: () => void;
}) {
  const c = history.contribution;
  return (
    <Card size="small" styles={{ body: { padding: 16 } }}>
      <Flex align="center" gap={20} wrap>
        <MonthStrip history={history} />

        <Flex align="center" gap={8} style={{ minWidth: 160, flex: 1 }}>
          <Text strong>{c.name}</Text>
          {history.missedCount > 0 && (
            <Tag bordered={false} color={STATUS.serious}>
              {history.missedCount} manquant{history.missedCount > 1 ? "s" : ""}
            </Tag>
          )}
        </Flex>

        <Figure label="Attendu" value={`${formatCents(c.expectedAmountCents)}/mois`} />
        <Figure label="Reçu sur la période" value={formatCents(history.receivedCents)} strong />
        <Figure
          label="Dernier versement"
          value={history.lastReceivedMonth ? formatMonthLabel(`${history.lastReceivedMonth}-01`) : "—"}
        />

        <Flex>
          <Button type="text" size="small" icon={<EditOutlined />} aria-label="Modifier" onClick={onEdit} />
          <Tooltip title="Mettre en pause — l'apport cesse d'être attendu">
            <Button
              type="text"
              size="small"
              icon={<PauseCircleOutlined />}
              aria-label="Mettre en pause"
              onClick={onPause}
            />
          </Tooltip>
          <Popconfirm
            title={`Supprimer « ${c.name} » ?`}
            description="Les transactions ne bougent pas ; seul l'apport attendu disparaît."
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={onDelete}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
          </Popconfirm>
        </Flex>
      </Flex>
    </Card>
  );
}

const MONTH_COLOR: Record<MonthState, string | undefined> = {
  received: MONEY.income,
  anomaly: STATUS.warning,
  // Settled, but by a lump rather than on its own line — so not the same green
  // as a payment the app could actually point at.
  covered: STATUS.warning,
  missed: STATUS.serious,
  pending: undefined,
  before: undefined,
};

const MONTH_WORD: Record<MonthState, string> = {
  received: "reçu",
  anomaly: "montant inhabituel",
  covered: "rattrapé par un versement groupé",
  missed: "non versé",
  pending: "en attente",
  before: "pas encore en place",
};

function MonthStrip({ history }: { history: ContributionHistory }) {
  const { token } = theme.useToken();
  return (
    <Flex gap={3} align="center">
      {history.months.map((m) => (
        <Tooltip
          key={m.month}
          title={`${formatMonthLabel(`${m.month}-01`)} — ${MONTH_WORD[m.state]}${
            m.receivedCents ? ` · ${formatCents(m.receivedCents)}` : ""
          }`}
        >
          <div
            aria-label={`${m.month} ${MONTH_WORD[m.state]}`}
            style={{
              width: 9,
              height: 22,
              borderRadius: 2,
              background:
                MONTH_COLOR[m.state] ??
                (m.state === "pending" ? token.colorFillSecondary : token.colorFillQuaternary),
            }}
          />
        </Tooltip>
      ))}
    </Flex>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Flex vertical gap={0} style={{ minWidth: 130 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text strong={strong} style={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}>
        {value}
      </Text>
    </Flex>
  );
}
