"use client";

import { useTheme } from "next-themes";
import { Card, Flex, Progress, Tag, Tooltip, Typography, theme } from "antd";
import { HomeOutlined, InfoCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { PALETTES, MONEY, STATUS } from "@shared/palette";
import { formatCents, formatDateShort } from "@shared/format";
import type { CreditListItem } from "@application/credits";

const { Text } = Typography;

/**
 * One loan, told in the order it matters: how far through am I, what does it
 * cost, and what do I actually own of the thing it bought.
 */
export function CreditCard({
  item,
  hideSchedule = false,
}: {
  item: CreditListItem;
  /** The detail page expands the schedule itself, so the card omits it. */
  hideSchedule?: boolean;
}) {
  const { credit, linkedAsset, summary, borrowers, deferralMonths } = item;
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const { token } = theme.useToken();
  const series = PALETTES.bleu.series[mode];

  const progress = summary?.progress ?? null;
  const principal = credit.principalCents ?? 0;

  const capitalPct =
    progress && principal > 0
      ? Math.round((progress.principalPaidCents / principal) * 100)
      : null;
  const timePct =
    progress && summary ? Math.round((progress.paidCount / summary.termMonths) * 100) : null;

  return (
    <Card>
      <Flex vertical gap={18}>
        <Flex align="center" gap={8} wrap>
          <Text strong style={{ fontSize: 16 }}>
            {credit.name}
          </Text>
          {credit.taegBps != null && <Tag>TAEG {(credit.taegBps / 100).toFixed(2)} %</Tag>}
          {credit.interestRateBps != null && (
            <Tag>Taux {(credit.interestRateBps / 100).toFixed(2)} %</Tag>
          )}
          {deferralMonths !== null && <Tag color="warning">Différé {deferralMonths} mois</Tag>}
          {!credit.isActive && <Tag>Soldé</Tag>}
        </Flex>

        {/* The gauge anchors the card: one number, read in a glance. */}
        <Flex gap={28} wrap align="center">
          {capitalPct !== null && (
            <Flex vertical align="center" gap={2}>
              <Progress
                type="circle"
                size={112}
                percent={capitalPct}
                strokeColor={STATUS.good}
                format={(p) => (
                  <Flex vertical gap={0}>
                    <Text strong style={{ fontSize: 22 }}>
                      {p}%
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      remboursé
                    </Text>
                  </Flex>
                )}
              />
            </Flex>
          )}

          <Flex gap={28} wrap style={{ flex: 1, minWidth: 260 }}>
            <Figure
              label="Capital restant dû"
              value={formatCents(credit.valueCents)}
              color={MONEY.expense}
              hint={
                progress ? `${formatCents(progress.principalPaidCents)} déjà remboursés` : undefined
              }
            />
            {summary && (
              <Figure
                label="Échéance"
                value={formatCents(summary.monthlyPaymentCents)}
                hint={
                  summary.monthlyTotalCents > summary.monthlyPaymentCents
                    ? `+ ${formatCents(summary.monthlyTotalCents - summary.monthlyPaymentCents)} d'assurance`
                    : "hors assurance"
                }
              />
            )}
            {summary && (
              <Figure
                label="Fin"
                value={summary.endDate ? formatDateShort(summary.endDate) : "—"}
                hint={
                  progress
                    ? `${progress.remainingCount} échéances restantes`
                    : `${summary.termMonths} mensualités`
                }
              />
            )}
          </Flex>
        </Flex>

        {/* The insight a statement never gives you: you are always further
            through the calendar than through the capital, because the early
            instalments are mostly interest. The gap is the cost, made visible. */}
        {capitalPct !== null && timePct !== null && (
          <Flex vertical gap={6}>
            <Bar label="Temps écoulé" pct={timePct} color={series[0]} />
            <Bar label="Capital remboursé" pct={capitalPct} color={STATUS.good} />
            {timePct > capitalPct && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {timePct - capitalPct} points d&apos;écart : les premières échéances paient surtout
                les intérêts.
              </Text>
            )}
          </Flex>
        )}

        {summary && principal > 0 && (
          <CostBar
            principal={principal}
            interest={summary.totalInterestCents}
            insurance={summary.totalInsuranceCents}
            fees={summary.feesCents}
            total={summary.totalPaidCents}
            colors={series}
            border={token.colorBgContainer}
          />
        )}

        {/* What you actually own of the thing this loan bought. For a mortgage
            this is the number that matters, and it is nowhere on a statement. */}
        {linkedAsset && (
          <Equity
            assetName={linkedAsset.name}
            assetValue={linkedAsset.valueCents}
            debt={credit.valueCents}
            colors={series}
            border={token.colorBgContainer}
          />
        )}

        {borrowers.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Assurance emprunteur :{" "}
            {borrowers
              .map((b) => `${b.personName} ${b.monthlyCents != null ? formatCents(b.monthlyCents) : "—"}`)
              .join(" · ")}
          </Text>
        )}

        {!hideSchedule && (
          <Flex justify="flex-end">
            <Link href={`/credits/${credit.id}`}>Échéancier et coût détaillé →</Link>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

function Figure({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
      {hint && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {hint}
        </Text>
      )}
    </Flex>
  );
}

/** A labelled bar. Percentages are printed, so the length is never the only cue. */
function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <Flex align="center" gap={10}>
      <Text style={{ fontSize: 12, width: 130, flexShrink: 0 }} type="secondary">
        {label}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Progress percent={pct} showInfo={false} size={["100%", 8]} strokeColor={color} />
      </div>
      <Text style={{ fontSize: 12, width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {pct}%
      </Text>
    </Flex>
  );
}

/**
 * What the loan costs, as one bar.
 *
 * Segments are separated by a 2px gap in the card colour so adjacent fills do
 * not bleed together, and every segment is named with its amount underneath —
 * identity never rests on the colour alone.
 */
function CostBar({
  principal,
  interest,
  insurance,
  fees,
  total,
  colors,
  border,
}: {
  principal: number;
  interest: number;
  insurance: number;
  fees: number;
  total: number;
  colors: readonly string[];
  border: string;
}) {
  const parts = [
    { label: "Capital emprunté", value: principal, color: colors[0] },
    { label: "Intérêts", value: interest, color: colors[1] },
    { label: "Assurance", value: insurance, color: colors[3] },
    { label: "Frais", value: fees, color: colors[6] },
  ].filter((p) => p.value > 0);

  return (
    <Flex vertical gap={8}>
      <Flex justify="space-between" align="baseline">
        <Text type="secondary" style={{ fontSize: 12 }}>
          Ce que ce crédit vous coûtera en tout
        </Text>
        <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(total)}
        </Text>
      </Flex>
      <Flex style={{ width: "100%", height: 12, gap: 2 }}>
        {parts.map((p) => (
          <div
            key={p.label}
            title={`${p.label} ${formatCents(p.value)}`}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.color,
              borderRadius: 4,
              outline: `2px solid ${border}`,
            }}
          />
        ))}
      </Flex>
      <Flex gap={16} wrap>
        {parts.map((p) => (
          <Flex key={p.label} align="center" gap={6}>
            <span
              aria-hidden
              style={{ width: 9, height: 9, borderRadius: 3, background: p.color }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {p.label} {formatCents(p.value)}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}

/** Asset value minus what is still owed: the part that is actually yours. */
function Equity({
  assetName,
  assetValue,
  debt,
  colors,
  border,
}: {
  assetName: string;
  assetValue: number;
  debt: number;
  colors: readonly string[];
  border: string;
}) {
  const equity = assetValue - debt;
  const ownedPct = assetValue > 0 ? Math.max(0, Math.min(100, (equity / assetValue) * 100)) : 0;

  return (
    <Flex vertical gap={8}>
      <Flex justify="space-between" align="baseline" wrap gap={8}>
        <Flex align="center" gap={6}>
          {/* The icon is the link: a house you can click through to the asset
              it stands for reads faster than a worded link beside it. */}
          <Tooltip title={`Voir ${assetName} dans le patrimoine`}>
            <Link href="/patrimoine" aria-label={`Voir ${assetName} dans le patrimoine`}>
              <HomeOutlined style={{ fontSize: 15 }} />
            </Link>
          </Tooltip>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Sur <Link href="/patrimoine">{assetName}</Link>, ce qui est à vous
          </Text>
          <Tooltip title="Valeur du bien moins le capital restant dû. C'est la part que vous possédez réellement.">
            <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
          </Tooltip>
        </Flex>
        <Text
          strong
          style={{
            fontVariantNumeric: "tabular-nums",
            color: equity >= 0 ? MONEY.income : MONEY.expense,
          }}
        >
          {formatCents(equity)}
        </Text>
      </Flex>
      <Flex style={{ width: "100%", height: 12, gap: 2 }}>
        <div
          style={{
            width: `${ownedPct}%`,
            background: colors[2],
            borderRadius: 4,
            outline: `2px solid ${border}`,
          }}
        />
        <div
          style={{
            width: `${100 - ownedPct}%`,
            background: colors[7],
            borderRadius: 4,
            outline: `2px solid ${border}`,
          }}
        />
      </Flex>
      <Flex gap={16} wrap>
        <Legend color={colors[2]} label={`À vous ${formatCents(Math.max(0, equity))}`} />
        <Legend color={colors[7]} label={`Restant dû ${formatCents(debt)}`} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          bien valorisé {formatCents(assetValue)}
        </Text>
      </Flex>
    </Flex>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Flex align="center" gap={6}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
    </Flex>
  );
}
