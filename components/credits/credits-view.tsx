"use client";

import Link from "next/link";
import { Card, Col, Collapse, Empty, Flex, Progress, Row, Statistic, Tag, Typography } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { MONEY, STATUS } from "@shared/palette";
import { formatCents, formatDateShort } from "@shared/format";
import { AmortizationDetail } from "@/components/assets/amortization-detail";
import type { CreditListItem, CreditsTotals } from "@application/credits";

const { Title, Text } = Typography;

/**
 * Credits, seen as loans rather than as negative net worth.
 *
 * The échéance leads every figure and the insurance is added visibly beside
 * it, never folded in: an offre de prêt quotes capital + interest, French
 * lenders often debit the premium separately, and showing one merged number
 * makes the app look like it disagrees with the contract.
 */
export function CreditsView({
  credits,
  totals,
}: {
  credits: CreditListItem[];
  totals: CreditsTotals;
}) {
  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Crédits
        </Title>
        <Text type="secondary">
          Ce qu&apos;il reste à rembourser, ce qu&apos;ils coûtent vraiment, et le bien
          que chacun finance.
        </Text>
      </div>

      {totals.count > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic
                title="Capital restant dû"
                value={formatCents(totals.outstandingCents)}
                valueStyle={{ color: MONEY.expense }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {totals.count} crédit{totals.count > 1 ? "s" : ""} en cours
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic title="Échéances" value={formatCents(totals.monthlyPaymentCents)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {totals.monthlyTotalCents > totals.monthlyPaymentCents
                  ? `+ ${formatCents(totals.monthlyTotalCents - totals.monthlyPaymentCents)} d'assurance = ${formatCents(totals.monthlyTotalCents)}`
                  : "hors assurance"}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic title="Coût total du crédit" value={formatCents(totals.totalCostCents)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                intérêts, assurance et frais sur toute la durée
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      {credits.length === 0 ? (
        <Card>
          <Empty
            description="Aucun crédit. Ajoutez-en un depuis Patrimoine."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <Flex vertical gap={12}>
          {credits.map(({ credit, linkedAsset, summary, borrowers, deferralMonths }) => {
            const progress = summary?.progress;
            const paidPct =
              progress && credit.principalCents
                ? Math.round((progress.principalPaidCents / credit.principalCents) * 100)
                : null;

            return (
              <Card key={credit.id} size="small">
                <Flex justify="space-between" align="flex-start" wrap gap={12}>
                  <Flex vertical gap={4} style={{ minWidth: 260 }}>
                    <Flex align="center" gap={8} wrap>
                      <Text strong>{credit.name}</Text>
                      {!credit.isActive && <Tag>Soldé</Tag>}
                      {deferralMonths !== null && <Tag color="warning">Différé {deferralMonths} mois</Tag>}
                    </Flex>

                    <Text style={{ color: MONEY.expense, fontVariantNumeric: "tabular-nums" }}>
                      −{formatCents(credit.valueCents)} restant dû
                    </Text>

                    {summary && (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        échéance {formatCents(summary.monthlyPaymentCents)}
                        {summary.monthlyTotalCents > summary.monthlyPaymentCents &&
                          ` + ${formatCents(summary.monthlyTotalCents - summary.monthlyPaymentCents)} d'assurance = ${formatCents(summary.monthlyTotalCents)}`}
                        /mois
                        {summary.endDate && ` · jusqu'au ${formatDateShort(summary.endDate)}`}
                      </Text>
                    )}

                    {/* Assurance emprunteur is priced per head, so a shared loan
                        carries two different premiums rather than one figure. */}
                    {borrowers.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Assurance :{" "}
                        {borrowers
                          .map(
                            (b) =>
                              `${b.personName} ${b.monthlyCents != null ? formatCents(b.monthlyCents) : "—"}`,
                          )
                          .join(" · ")}
                      </Text>
                    )}

                    <Flex align="center" gap={6}>
                      <LinkOutlined style={{ opacity: 0.5 }} />
                      {linkedAsset ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Finance <Text strong style={{ fontSize: 12 }}>{linkedAsset.name}</Text> ·
                          valorisé {formatCents(linkedAsset.valueCents)} ·{" "}
                          <Link href="/patrimoine">voir</Link>
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Rattaché à aucun bien
                        </Text>
                      )}
                    </Flex>
                  </Flex>

                  {paidPct !== null && (
                    <Flex vertical align="center" gap={2} style={{ minWidth: 120 }}>
                      <Progress
                        type="circle"
                        size={72}
                        percent={paidPct}
                        strokeColor={STATUS.good}
                        format={(p) => `${p}%`}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        capital remboursé
                      </Text>
                    </Flex>
                  )}
                </Flex>

                <Collapse
                  ghost
                  size="small"
                  items={[
                    {
                      key: "detail",
                      label: <Text style={{ fontSize: 13 }}>Échéancier et coût</Text>,
                      children: <AmortizationDetail asset={credit} />,
                    },
                  ]}
                />
              </Card>
            );
          })}
        </Flex>
      )}
    </Flex>
  );
}
