"use client";

import { Card, Flex, Progress, Tag, Tooltip, Typography, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { MONEY, STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { ResteAVivre } from "@application/reste-a-vivre";

const { Text, Title } = Typography;

/**
 * The headline: what is left to spend freely this month.
 *
 * This is the one number a budget app exists to answer, so it gets the top of
 * the page and the largest type. The arithmetic behind it is shown inline
 * rather than hidden in a tooltip — "revenus − charges fixes − budgets" is the
 * whole model, and a figure you cannot reconstruct is a figure you do not
 * trust.
 */
export function ResteAVivreCard({ data }: { data: ResteAVivre }) {
  const { token } = theme.useToken();

  const committed = data.fixedExpensesTotalCents + data.budgetsTotalMonthlyCents;
  const income = data.monthlyIncomeCents;
  // Guard the divide: a household with no recorded income yet would otherwise
  // render a NaN-width bar.
  const committedPct = income > 0 ? Math.min(100, Math.round((committed / income) * 100)) : 0;
  const negative = data.resteAVivreCents < 0;

  return (
    <Card>
      <Flex justify="space-between" align="flex-start" wrap gap={16}>
        <div>
          <Flex align="center" gap={8}>
            <Text type="secondary">Reste à vivre · {data.monthLabel}</Text>
            <Tooltip
              title={
                data.mode === "contributions"
                  ? "Basé sur les apports déclarés de chaque membre du foyer."
                  : `Basé sur vos revenus constatés, moyennés sur ${data.monthsAveraged} mois.`
              }
            >
              <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
            </Tooltip>
          </Flex>
          <Title
            level={1}
            style={{
              margin: "4px 0 0",
              fontVariantNumeric: "tabular-nums",
              color: negative ? MONEY.expense : undefined,
            }}
          >
            {formatCents(data.resteAVivreCents)}
          </Title>
          {negative && (
            // Never colour alone: the tag says it in words too.
            <Tag color="error" style={{ marginTop: 8 }}>
              Vos engagements dépassent vos revenus
            </Tag>
          )}
        </div>

        {/* The arithmetic, laid out left to right in the order it is computed.
            The first term is deliberately not called "Revenus": the stat tiles
            below show income actually received this period, which is a
            different number, and two figures sharing a label on one screen is
            how people stop trusting both. */}
        <Flex gap={28} wrap>
          <Term
            label={data.mode === "contributions" ? "Apports du foyer" : "Revenus moyens"}
            cents={income}
            color={MONEY.income}
          />
          <Term label="Charges fixes" cents={-data.fixedExpensesTotalCents} />
          <Term label="Budgets" cents={-data.budgetsTotalMonthlyCents} />
        </Flex>
      </Flex>

      <div style={{ marginTop: 16 }}>
        <Progress
          percent={committedPct}
          showInfo={false}
          strokeColor={committedPct >= 100 ? STATUS.critical : committedPct >= 85 ? STATUS.warning : token.colorPrimary}
          size={["100%", 6]}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {committedPct}% de vos revenus sont déjà engagés ({formatCents(committed)})
        </Text>
      </div>
    </Card>
  );
}

function Term({ label, cents, color }: { label: string; cents: number; color?: string }) {
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
        {label}
      </Text>
      <Text strong style={{ fontVariantNumeric: "tabular-nums", color, fontSize: 16 }}>
        {/* `-0` formats as "-0,00 €", which reads like a rounding error rather
            than "nothing". Normalise it to plain zero. */}
        {formatCents(cents === 0 ? 0 : cents)}
      </Text>
    </div>
  );
}
