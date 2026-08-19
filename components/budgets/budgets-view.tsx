"use client";

import Link from "next/link";
import { Button, Card, Empty, Flex, Tooltip, Typography, theme } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import { BudgetItemRow } from "./budget-row";
import type { CategoryBudgetStatus } from "@application/budgets";

const { Text } = Typography;

/**
 * Budgets: one ceiling per category, worst first.
 *
 * Sorted by how close each is to its ceiling rather than alphabetically — the
 * page exists to surface the ones about to be blown, and a list you have to
 * scan for trouble is doing half its job.
 *
 * One card at the top, then rows that lead to their own page, the same shape
 * as Crédits and Patrimoine. A budget is created from the button in the header,
 * where the category is chosen; the list used to double as a category picker,
 * which made it two things at once and neither of them clearly.
 */
export function BudgetsView({
  statuses,
  monthlyBudgetCents,
  monthlySpentCents,
  monthElapsedPct,
}: {
  statuses: CategoryBudgetStatus[];
  monthlyBudgetCents: number;
  monthlySpentCents: number;
  monthElapsedPct: number;
}) {
  const { token } = theme.useToken();

  const remaining = monthlyBudgetCents - monthlySpentCents;
  const usedPct =
    monthlyBudgetCents > 0 ? Math.round((monthlySpentCents / monthlyBudgetCents) * 100) : 0;
  const overCount = statuses.filter((s) => s.ratio >= 1).length;
  const over = remaining < 0;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Budgets" }]}
        description="Un plafond par catégorie. Les charges fixes ont leur propre page."
        actions={
          <Link href="/budgets/nouveau">
            <Button type="primary" icon={<PlusOutlined />}>
              Ajouter un budget
            </Button>
          </Link>
        }
      />

      {statuses.length > 0 && (
        <Card>
          <Flex vertical gap={16}>
            <Flex justify="space-between" align="flex-start" wrap gap={16}>
              <Flex vertical gap={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {over ? "Dépassement ce mois" : "Reste à dépenser ce mois"}
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: 34,
                    fontVariantNumeric: "tabular-nums",
                    color: over ? STATUS.critical : undefined,
                  }}
                >
                  {formatCents(Math.abs(remaining))}
                </Text>
              </Flex>

              <Flex gap={32} wrap>
                <Figure label="Plafonds" value={formatCents(monthlyBudgetCents)} />
                <Figure label="Dépensé" value={formatCents(monthlySpentCents)} />
              </Flex>
            </Flex>

            {monthlyBudgetCents > 0 && (
              <Flex vertical gap={6}>
                {/* The spend against the ceilings, with a mark where the month
                    itself has got to. The gap between the two is the whole
                    point: 60 % spent is fine on the 20th and not on the 5th. */}
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
                      background: over ? STATUS.critical : token.colorPrimary,
                      borderRadius: 4,
                    }}
                  />
                  <Tooltip title={`Le mois est écoulé à ${monthElapsedPct} %`}>
                    <div
                      style={{
                        position: "absolute",
                        insetBlock: -3,
                        left: `${monthElapsedPct}%`,
                        width: 2,
                        marginLeft: -1,
                        background: token.colorTextSecondary,
                        borderRadius: 1,
                      }}
                    />
                  </Tooltip>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {usedPct} % des plafonds utilisés, pour un mois écoulé à {monthElapsedPct} %.
                  {overCount > 0 &&
                    ` ${overCount} budget${overCount > 1 ? "s" : ""} déjà dépassé${overCount > 1 ? "s" : ""}.`}
                </Text>
              </Flex>
            )}
          </Flex>
        </Card>
      )}

      {statuses.length === 0 ? (
        <Card>
          <Empty description="Aucun budget défini" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Link href="/budgets/nouveau">
              <Button type="primary" icon={<PlusOutlined />}>
                Ajouter un budget
              </Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <Flex vertical gap={8}>
          {statuses.map((s) => (
            <BudgetItemRow key={s.id} status={s} />
          ))}
        </Flex>
      )}
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
