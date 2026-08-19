"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Card, Empty, Flex, Popconfirm, Tooltip, Typography, theme } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { STATUS } from "@shared/palette";
import { formatCents, formatDateShort, formatMonthLabel } from "@shared/format";
import { BudgetForm } from "./budget-form";
import type { CategoryBudgetStatus, MonthlySpend } from "@application/budgets";

const { Text } = Typography;

export type BudgetTransaction = {
  id: number;
  date: string;
  description: string;
  amountCents: number;
};

/**
 * One budget, in full.
 *
 * Three questions, in the order they get asked: where am I in this period, is
 * this month like the others, and what did I actually buy. The list row answers
 * only the first, which is why it stays four figures and a bar.
 */
export function BudgetDetail({
  status,
  history,
  monthlyCeilingCents,
  transactions,
  transactionsTotal,
}: {
  status: CategoryBudgetStatus;
  history: MonthlySpend[];
  /** The ceiling on a monthly footing — a weekly one times 52/12. */
  monthlyCeilingCents: number;
  transactions: BudgetTransaction[];
  transactionsTotal: number;
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);

  const weekly = status.period === "weekly";
  const thisPeriod = weekly ? "cette semaine" : "ce mois-ci";
  const periodOf = weekly ? "de la semaine" : "du mois";
  const periodSubject = weekly ? "la semaine" : "le mois";

  const over = status.ratio >= 1;
  const near = status.ratio >= 0.8 && !over;
  const color = over ? STATUS.critical : near ? STATUS.warning : token.colorPrimary;
  const usedPct = Math.round(status.ratio * 100);
  const elapsedPct = Math.round(
    ((status.daysTotal - status.daysRemaining) / status.daysTotal) * 100,
  );
  const projected = status.projectedCents;

  async function remove() {
    const res = await fetch(`/api/budgets/${status.id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    message.success("Budget supprimé");
    router.push("/budgets");
    router.refresh();
  }

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Budgets", href: "/budgets" }, { label: status.category.name }]}
        description={`Plafond de ${formatCents(status.budgetCents)} par ${status.periodLabel}, du ${formatDateShort(status.periodStart)} au ${formatDateShort(status.periodEnd)}.`}
        actions={
          <Flex gap={8}>
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Modifier
            </Button>
            <Popconfirm
              title={`Supprimer le budget « ${status.category.name} » ?`}
              description="Les transactions de la catégorie ne sont pas touchées."
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
            <Flex vertical gap={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Dépensé {thisPeriod}
              </Text>
              <Text
                strong
                style={{
                  fontSize: 34,
                  fontVariantNumeric: "tabular-nums",
                  color: over ? STATUS.critical : undefined,
                }}
              >
                {formatCents(status.spentCents)}
              </Text>
            </Flex>

            <Flex gap={32} wrap>
              <Figure label="Plafond" value={formatCents(status.budgetCents)} />
              <Figure
                label={over ? "Dépassement" : "Reste"}
                value={formatCents(Math.abs(status.remainingCents))}
                color={over ? STATUS.critical : undefined}
              />
              <Figure
                label="Jours restants"
                value={String(status.daysRemaining)}
              />
            </Flex>
          </Flex>

          <Flex vertical gap={6}>
            <div
              style={{
                position: "relative",
                height: 12,
                background: token.colorFillSecondary,
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, usedPct)}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 4,
                }}
              />
              {/* Where the period itself has got to. Spending is only ahead or
                  behind relative to the calendar, never on its own. */}
              <Tooltip title={`Période écoulée à ${elapsedPct} %`}>
                <div
                  style={{
                    position: "absolute",
                    insetBlock: -3,
                    left: `${elapsedPct}%`,
                    width: 2,
                    marginLeft: -1,
                    background: token.colorTextSecondary,
                    borderRadius: 1,
                  }}
                />
              </Tooltip>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {usedPct} % du plafond utilisé, pour une période écoulée à {elapsedPct} %.
              {projected !== null &&
                !over &&
                ` À ce rythme, ${periodSubject} se termine à ${formatCents(projected)}${
                  projected > status.budgetCents ? " — au-dessus du plafond" : ""
                }.`}
            </Text>
          </Flex>
        </Flex>
      </Card>

      <Card title="Les six derniers mois">
        <Flex vertical gap={12}>
          <History
            history={history}
            ceilingCents={monthlyCeilingCents}
            weekly={weekly}
          />
        </Flex>
      </Card>

      <Card
        title={`Dépenses ${periodOf}`}
        extra={
          transactionsTotal > transactions.length ? (
            <Link
              href={`/transactions?categoryIds=${status.category.id}&from=${status.periodStart}&to=${status.periodEnd}`}
            >
              Voir les {transactionsTotal} dépenses
            </Link>
          ) : null
        }
      >
        {transactions.length === 0 ? (
          <Empty
            description="Aucune dépense sur cette période"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Flex vertical>
            {transactions.map((t, i) => (
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

      <BudgetForm
        open={editing}
        onOpenChange={setEditing}
        categories={[
          {
            id: status.category.id,
            name: status.category.name,
            color: status.category.color,
          },
        ]}
        budget={{
          id: status.id,
          categoryId: status.category.id,
          amountCents: status.budgetCents,
          period: status.period,
        }}
      />
    </Flex>
  );
}

/**
 * Monthly spend against the ceiling, one bar per month.
 *
 * Scaled to the largest of the two so the ceiling mark is always on the chart,
 * and months that went over are the only ones that take a colour.
 */
function History({
  history,
  ceilingCents,
  weekly,
}: {
  history: MonthlySpend[];
  ceilingCents: number;
  weekly: boolean;
}) {
  const { token } = theme.useToken();
  const max = Math.max(ceilingCents, ...history.map((h) => h.spentCents), 1) * 1.05;

  return (
    <>
      {history.map((h) => {
        const over = h.spentCents > ceilingCents;
        return (
          <Flex key={h.month} vertical gap={4}>
            <Flex justify="space-between" align="baseline">
              <Text style={{ fontSize: 13 }}>{formatMonthLabel(`${h.month}-01`)}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  color: over ? STATUS.critical : token.colorTextSecondary,
                }}
              >
                {formatCents(h.spentCents)}
                {over && " · dépassé"}
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
                  width: `${(h.spentCents / max) * 100}%`,
                  height: "100%",
                  background: over ? STATUS.critical : token.colorPrimary,
                  opacity: over ? 1 : 0.75,
                  borderRadius: 3,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  insetBlock: -2,
                  left: `${(ceilingCents / max) * 100}%`,
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
        Le repère marque le plafond
        {weekly
          ? ` ramené au mois, soit ${formatCents(ceilingCents)}.`
          : ` de ${formatCents(ceilingCents)}.`}
      </Text>
    </>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums", color }}>
        {value}
      </Text>
    </Flex>
  );
}
