"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Card, Empty, Flex, Popconfirm, Tag, Typography, theme } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { STATUS } from "@shared/palette";
import { formatCents, formatDateShort, formatMonthLabel } from "@shared/format";
import { FixedExpenseForm } from "./fixed-expense-form";
import { FIXED_EXPENSE_STATE, describeDue, describeSchedule } from "./fixed-expense-state";
import type { CategoryRow } from "@domain/entities";
import type { FixedExpenseMonth, FixedExpenseStatus } from "@application/fixed-expenses";

const { Text } = Typography;

/**
 * One recurring charge in full: where it stands this month, whether it has
 * drifted over the year, and the payments that were matched to it.
 *
 * The history is the part a list row cannot carry, and the part that catches
 * the things worth catching — an indexed rent, a subscription that quietly
 * went up, a direct debit that stopped.
 */
export function FixedExpenseDetail({
  status,
  history,
  categories,
}: {
  status: FixedExpenseStatus;
  history: FixedExpenseMonth[];
  categories: CategoryRow[];
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);

  const fx = status.fixedExpense;
  const state = FIXED_EXPENSE_STATE[status.state];
  const paused = !fx.isActive;
  const variance = status.variancePct;

  async function remove() {
    const res = await fetch(`/api/fixed-expenses/${fx.id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    message.success("Charge supprimée");
    router.push("/frais-fixes");
    router.refresh();
  }

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Frais fixes", href: "/frais-fixes" }, { label: fx.name }]}
        description={`${formatCents(fx.expectedAmountCents)} attendus ${describeSchedule(fx)}, reconnus au libellé « ${fx.matchPattern} ».`}
        actions={
          <Flex gap={8}>
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Modifier
            </Button>
            <Popconfirm
              title={`Supprimer « ${fx.name} » ?`}
              description="Les transactions déjà rapprochées ne sont pas touchées."
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

      <Card>
        <Flex vertical gap={16}>
          <Flex justify="space-between" align="flex-start" wrap gap={16}>
            <Flex vertical gap={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {fx.cadence === "monthly" ? "Payé ce mois" : "Payé sur la période en cours"}
              </Text>
              <Text
                strong
                style={{
                  fontSize: 34,
                  fontVariantNumeric: "tabular-nums",
                  color: status.state === "overdue" ? STATUS.critical : undefined,
                }}
              >
                {status.paidAmountCents ? formatCents(status.paidAmountCents) : "—"}
              </Text>
              <Flex align="center" gap={8}>
                {/* The state is a word first; the colour only repeats it. */}
                <Tag
                  bordered={false}
                  color={paused ? undefined : state.color}
                  style={{ marginInlineEnd: 0 }}
                >
                  {paused ? "En pause" : state.label}
                </Tag>
                {variance !== null && Math.abs(variance) >= 1 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {variance > 0 ? "+" : "−"}
                    {Math.abs(Math.round(variance))} % par rapport à l&apos;attendu
                  </Text>
                )}
              </Flex>
            </Flex>

            <Flex gap={32} wrap>
              <Figure
                label={fx.cadence === "monthly" ? "Attendu" : "Attendu par prélèvement"}
                value={formatCents(fx.expectedAmountCents)}
              />
              <Figure
                label={fx.cadence === "monthly" ? "Échéance" : "Prochaine échéance"}
                value={describeDue(fx, status.nextDueDate)}
              />
              <Figure label="Tolérance" value={`${fx.tolerancePct} %`} />
              <Figure label="Catégorie" value={status.category?.name ?? "—"} />
            </Flex>
          </Flex>
        </Flex>
      </Card>

      <Card title={history.length > 12 ? "Les deux dernières années" : "Les douze derniers mois"}>
        <History history={history} expectedCents={fx.expectedAmountCents} />
      </Card>

      <Card
        title="Paiements rapprochés ce mois"
        extra={
          status.category ? (
            <Link href={`/transactions?categoryIds=${status.category.id}`}>
              Voir la catégorie
            </Link>
          ) : (
            <Link href={`/transactions?search=${encodeURIComponent(fx.matchPattern)}`}>
              Chercher ce libellé
            </Link>
          )
        }
      >
        {status.matched.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              paused
                ? "Charge en pause : aucun rapprochement n'est fait"
                : "Aucun paiement rapproché ce mois-ci"
            }
          />
        ) : (
          <Flex vertical>
            {status.matched.map((t, i) => (
              <Flex
                key={t.id}
                justify="space-between"
                align="baseline"
                gap={12}
                style={{
                  paddingBlock: 8,
                  borderTop: i === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12, width: 82, flex: "none" }}>
                  {formatDateShort(t.date)}
                </Text>
                <Text style={{ flex: 1 }} ellipsis>
                  {t.description}
                </Text>
                <Text style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCents(Math.abs(t.amountCents))}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </Card>

      <FixedExpenseForm
        open={editing}
        onOpenChange={setEditing}
        expense={fx}
        categories={categories}
      />
    </Flex>
  );
}

/**
 * What was actually paid, month by month, against the expected amount.
 *
 * A month with nothing is drawn as an empty track rather than skipped: the
 * gap is the finding.
 */
function History({
  history,
  expectedCents,
}: {
  history: FixedExpenseMonth[];
  expectedCents: number;
}) {
  const { token } = theme.useToken();
  const max = Math.max(expectedCents, ...history.map((h) => h.paidCents), 1) * 1.05;

  return (
    <Flex vertical gap={10}>
      {history.map((h) => {
        const missing = h.paidCents === 0;
        const over = h.paidCents > expectedCents;
        return (
          <Flex key={h.month} vertical gap={4}>
            <Flex justify="space-between" align="baseline">
              <Text style={{ fontSize: 13 }}>{formatMonthLabel(`${h.month}-01`)}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  color: missing ? token.colorTextTertiary : token.colorTextSecondary,
                }}
              >
                {missing ? "rien de rapproché" : formatCents(h.paidCents)}
                {h.count > 1 && ` · ${h.count} paiements`}
              </Text>
            </Flex>
            <div
              style={{
                position: "relative",
                height: 6,
                background: token.colorFillSecondary,
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  width: `${(h.paidCents / max) * 100}%`,
                  height: "100%",
                  background: over ? STATUS.serious : token.colorPrimary,
                  opacity: over ? 1 : 0.75,
                  borderRadius: 3,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  insetBlock: -2,
                  left: `${(expectedCents / max) * 100}%`,
                  width: 2,
                  marginLeft: -1,
                  background: token.colorTextTertiary,
                  borderRadius: 1,
                }}
              />
            </div>
          </Flex>
        );
      })}
      <Text type="secondary" style={{ fontSize: 12 }}>
        Le repère marque le montant attendu, {formatCents(expectedCents)}.
      </Text>
    </Flex>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
    </Flex>
  );
}
