"use client";

import Link from "next/link";
import { Card, Col, Flex, Progress, Row, Tooltip, Typography, theme } from "antd";
import { HomeOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { formatCents, formatDateShort } from "@shared/format";
import type { CreditListItem } from "@application/credits";

const { Text } = Typography;

/**
 * The full picture of one loan, for its own page.
 *
 * Colour is used once, on the gauge. An earlier version painted the gauge, two
 * comparison bars, a four-colour cost bar and a two-colour equity bar into a
 * single card and the result was unreadable. The bars here are ordered parts of
 * a whole, so one hue stepped light-to-dark says everything a rainbow did
 * without asking the eye to decode five palettes at once.
 */
export function CreditCard({ item }: { item: CreditListItem }) {
  const { credit, linkedAsset, summary, borrowers, deferralMonths } = item;
  const { token } = theme.useToken();

  const progress = summary?.progress ?? null;
  const principal = credit.principalCents ?? 0;

  const capitalPct =
    progress && principal > 0 ? Math.round((progress.principalPaidCents / principal) * 100) : null;
  const timePct =
    progress && summary ? Math.round((progress.paidCount / summary.termMonths) * 100) : null;

  return (
    <Flex vertical gap={16}>
      <Card>
        <Flex gap={32} wrap align="center">
          {capitalPct !== null && (
            <Progress
              type="circle"
              size={116}
              percent={capitalPct}
              strokeColor={token.colorPrimary}
              format={(p) => (
                <Flex vertical gap={0}>
                  <Text strong style={{ fontSize: 24 }}>
                    {p}%
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    remboursé
                  </Text>
                </Flex>
              )}
            />
          )}

          <Row gutter={[28, 16]} style={{ flex: 1, minWidth: 280 }}>
            <Col xs={12} md={8}>
              <Figure
                label="Capital restant dû"
                value={formatCents(credit.valueCents)}
                hint={progress ? `${formatCents(progress.principalPaidCents)} remboursés` : undefined}
              />
            </Col>
            {summary && (
              <Col xs={12} md={8}>
                <Figure
                  label="Échéance"
                  value={formatCents(summary.monthlyPaymentCents)}
                  hint={
                    summary.monthlyTotalCents > summary.monthlyPaymentCents
                      ? `+ ${formatCents(summary.monthlyTotalCents - summary.monthlyPaymentCents)} d'assurance`
                      : "hors assurance"
                  }
                />
              </Col>
            )}
            {summary && (
              <Col xs={12} md={8}>
                <Figure
                  label="Fin"
                  value={summary.endDate ? formatDateShort(summary.endDate) : "—"}
                  hint={progress ? `${progress.remainingCount} échéances restantes` : undefined}
                />
              </Col>
            )}
            {credit.interestRateBps != null && (
              <Col xs={12} md={8}>
                <Figure
                  label="Taux nominal"
                  value={`${(credit.interestRateBps / 100).toFixed(2)} %`}
                  hint={
                    credit.taegBps != null ? `TAEG ${(credit.taegBps / 100).toFixed(2)} %` : undefined
                  }
                />
              </Col>
            )}
            {deferralMonths !== null && (
              <Col xs={12} md={8}>
                <Figure
                  label="Différé"
                  value={`${deferralMonths} mois`}
                  hint={
                    credit.signatureDate
                      ? `signé le ${formatDateShort(credit.signatureDate)}`
                      : undefined
                  }
                />
              </Col>
            )}
            {borrowers.length > 0 && (
              <Col xs={24} md={8}>
                <Figure
                  label="Assurance"
                  value={formatCents(borrowers.reduce((s, b) => s + (b.monthlyCents ?? 0), 0))}
                  hint={borrowers
                    .map(
                      (b) =>
                        `${b.personName} ${b.monthlyCents != null ? formatCents(b.monthlyCents) : "—"}`,
                    )
                    .join(" · ")}
                />
              </Col>
            )}
          </Row>
        </Flex>
      </Card>

      {/* The insight a statement never gives you: you are always further through
          the calendar than through the capital, because the early instalments
          are mostly interest. The gap is the cost, made visible. */}
      {capitalPct !== null && timePct !== null && (
        <Card size="small" title="Où vous en êtes">
          <Flex vertical gap={8}>
            <Bar label="Temps écoulé" pct={timePct} color={token.colorTextQuaternary} />
            <Bar label="Capital remboursé" pct={capitalPct} color={token.colorPrimary} />
            {timePct > capitalPct && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {timePct - capitalPct} points d&apos;écart : les premières échéances paient surtout
                les intérêts.
              </Text>
            )}
          </Flex>
        </Card>
      )}

      {summary && principal > 0 && (
        <Card size="small" title="Ce que ce crédit coûte">
          <StackBar
            total={summary.totalPaidCents}
            parts={[
              { label: "Capital emprunté", value: principal },
              { label: "Intérêts", value: summary.totalInterestCents },
              { label: "Assurance", value: summary.totalInsuranceCents },
              { label: "Frais", value: summary.feesCents },
            ]}
            base={token.colorPrimary}
            surface={token.colorBgContainer}
          />
        </Card>
      )}

      {/* What you actually own of the thing this loan bought — the number that
          matters on a mortgage, and nowhere on a statement. */}
      {linkedAsset && (
        <Card
          size="small"
          title={
            <Flex align="center" gap={6}>
              <Tooltip title={`Voir ${linkedAsset.name} dans le patrimoine`}>
                <Link href="/patrimoine" aria-label={`Voir ${linkedAsset.name} dans le patrimoine`}>
                  <HomeOutlined />
                </Link>
              </Tooltip>
              <span>Ce que vous possédez de {linkedAsset.name}</span>
              <Tooltip title="Valeur du bien moins le capital restant dû.">
                <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.45 }} />
              </Tooltip>
            </Flex>
          }
        >
          <StackBar
            total={linkedAsset.valueCents}
            parts={[
              { label: "À vous", value: Math.max(0, linkedAsset.valueCents - credit.valueCents) },
              { label: "Restant dû", value: credit.valueCents },
            ]}
            base={token.colorPrimary}
            surface={token.colorBgContainer}
          />
        </Card>
      )}
    </Flex>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
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

/** A labelled bar. The percentage is printed, so length is never the only cue. */
function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <Flex align="center" gap={10}>
      <Text style={{ fontSize: 12, width: 132, flexShrink: 0 }} type="secondary">
        {label}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Progress percent={pct} showInfo={false} size={["100%", 8]} strokeColor={color} />
      </div>
      <Text
        style={{ fontSize: 12, width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {pct}%
      </Text>
    </Flex>
  );
}

/**
 * Ordered parts of a whole, in one hue.
 *
 * Segments step down in opacity, largest first, so the ramp itself encodes the
 * order. Each is named with its amount beneath, so identity never rests on the
 * shade — which is also what keeps the lighter steps usable where they fall
 * below contrast on a pale surface.
 */
function StackBar({
  total,
  parts,
  base,
  surface,
}: {
  total: number;
  parts: { label: string; value: number }[];
  base: string;
  surface: string;
}) {
  const shown = parts.filter((p) => p.value > 0);
  const step = (i: number) => Math.max(0.22, 1 - i * 0.26);

  return (
    <Flex vertical gap={10}>
      <Flex justify="space-between" align="baseline">
        <Text type="secondary" style={{ fontSize: 12 }}>
          Total
        </Text>
        <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(total)}
        </Text>
      </Flex>
      <Flex style={{ width: "100%", height: 12, gap: 2 }}>
        {shown.map((p, i) => (
          <div
            key={p.label}
            title={`${p.label} ${formatCents(p.value)}`}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: base,
              opacity: step(i),
              borderRadius: 4,
              outline: `2px solid ${surface}`,
            }}
          />
        ))}
      </Flex>
      <Flex gap={18} wrap>
        {shown.map((p, i) => (
          <Flex key={p.label} align="center" gap={6}>
            <span
              aria-hidden
              style={{ width: 9, height: 9, borderRadius: 3, background: base, opacity: step(i) }}
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
