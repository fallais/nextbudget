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
  InputNumber,
  Modal,
  Progress,
  Row,
  Segmented,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { CategoryRow } from "@domain/entities";
import type { CategoryBudgetStatus } from "@application/budgets";

const { Title, Text } = Typography;

/**
 * Budgets: one card per tracked category, worst first.
 *
 * Sorted by how close each is to its ceiling rather than alphabetically — the
 * page exists to surface the ones about to be blown, and a list you have to
 * scan for trouble is doing half its job.
 */
export function BudgetsView({
  statuses,
  toBudget,
  coveredByFixed,
  monthlyEquivalent,
  monthlySpent,
}: {
  statuses: CategoryBudgetStatus[];
  toBudget: CategoryRow[];
  coveredByFixed: CategoryRow[];
  monthlyEquivalent: number;
  monthlySpent: number;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [saving, setSaving] = useState(false);

  function open(category: CategoryRow, current?: CategoryBudgetStatus) {
    setEditing(category);
    setAmount(current ? current.budgetCents / 100 : null);
    setPeriod(current?.period ?? "monthly");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${editing.id}/budget`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          budgetAmountCents: amount === null ? null : Math.round(amount * 100),
          budgetPeriod: amount === null ? null : period,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(body?.error ?? "Échec de l'enregistrement");
        return;
      }
      message.success(amount === null ? "Budget retiré" : "Budget enregistré");
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...statuses].sort((a, b) => b.ratio - a.ratio);
  const remaining = monthlyEquivalent - monthlySpent;

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Budgets
        </Title>
        <Text type="secondary">
          Un plafond par catégorie. Les charges fixes ont leur propre page.
        </Text>
      </div>

      {statuses.length > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={8}>
            <Card size="small">
              <Statistic title="Budgété / mois" value={formatCents(monthlyEquivalent)} />
            </Card>
          </Col>
          <Col xs={12} md={8}>
            <Card size="small">
              <Statistic title="Dépensé" value={formatCents(monthlySpent)} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic
                title={remaining >= 0 ? "Reste" : "Dépassement"}
                value={formatCents(Math.abs(remaining))}
                valueStyle={{ color: remaining >= 0 ? STATUS.good : STATUS.critical }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {sorted.length === 0 ? (
        <Card>
          <Empty description="Aucun budget défini" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {sorted.map((s) => {
            const pct = Math.min(100, Math.round(s.ratio * 100));
            const over = s.ratio >= 1;
            const near = s.ratio >= 0.8 && s.ratio < 1;
            return (
              <Col key={s.category.id} xs={24} md={12} xl={8}>
                <Card
                  size="small"
                  title={s.category.name}
                  extra={
                    <Button type="link" size="small" onClick={() => open(s.category, s)}>
                      Modifier
                    </Button>
                  }
                >
                  <Flex justify="space-between" align="baseline">
                    <Text strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 18 }}>
                      {formatCents(s.spentCents)}
                    </Text>
                    <Text type="secondary" style={{ fontVariantNumeric: "tabular-nums" }}>
                      / {formatCents(s.budgetCents)} · {s.periodLabel}
                    </Text>
                  </Flex>
                  <Progress
                    percent={pct}
                    showInfo={false}
                    size={["100%", 6]}
                    strokeColor={over ? STATUS.critical : near ? STATUS.warning : STATUS.good}
                  />
                  <Flex justify="space-between">
                    {/* State in words, not only in the bar's colour. */}
                    <Text style={{ fontSize: 12 }} type={over ? "danger" : "secondary"}>
                      {over
                        ? `Dépassé de ${formatCents(s.spentCents - s.budgetCents)}`
                        : `Reste ${formatCents(s.remainingCents)}`}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {s.daysRemaining} j restants
                    </Text>
                  </Flex>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {toBudget.length > 0 && (
        <Card size="small" title={`À budgétiser (${toBudget.length})`}>
          <Flex wrap gap={8}>
            {toBudget.map((c) => (
              <Button key={c.id} size="small" icon={<PlusOutlined />} onClick={() => open(c)}>
                {c.name}
              </Button>
            ))}
          </Flex>
        </Card>
      )}

      {coveredByFixed.length > 0 && (
        <Card size="small" title="Déjà couvertes par une charge fixe">
          <Flex wrap gap={6}>
            {coveredByFixed.map((c) => (
              <Tag key={c.id}>{c.name}</Tag>
            ))}
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Un budget en plus d&apos;une charge fixe compterait la même dépense deux fois.
          </Text>
        </Card>
      )}

      <Modal
        open={editing !== null}
        title={editing ? `Budget · ${editing.name}` : ""}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        okText="Enregistrer"
        cancelText="Annuler"
        footer={(_, { OkBtn, CancelBtn }) => (
          <Flex justify="space-between">
            <Button danger type="text" onClick={() => { setAmount(null); void save(); }}>
              Retirer le budget
            </Button>
            <Flex gap={8}>
              <CancelBtn />
              <OkBtn />
            </Flex>
          </Flex>
        )}
      >
        <Flex vertical gap={12} style={{ paddingBlock: 8 }}>
          <InputNumber
            autoFocus
            style={{ width: "100%" }}
            addonAfter="€"
            placeholder="Montant"
            min={0}
            value={amount}
            onChange={setAmount}
          />
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as "monthly" | "weekly")}
            options={[
              { value: "monthly", label: "Par mois" },
              { value: "weekly", label: "Par semaine" },
            ]}
          />
        </Flex>
      </Modal>
    </Flex>
  );
}
