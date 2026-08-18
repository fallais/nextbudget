"use client";

import { useState } from "react";
import { Button, Card, Col, Empty, Flex, Row, Statistic, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { AssetForm, type FormPerson } from "@/components/assets/asset-form";
import { MONEY } from "@shared/palette";
import { formatCents, formatDateShort } from "@shared/format";
import { CreditCard } from "./credit-card";
import type { CreditListItem, CreditsTotals } from "@application/credits";

const { Title, Text } = Typography;

/**
 * Credits, seen as loans rather than as negative net worth.
 *
 * The échéance leads every figure and the insurance is added visibly beside
 * it, never folded in: an offre de prêt quotes capital + interest, French
 * lenders often debit the premium separately, and one merged number makes the
 * app look like it disagrees with the contract.
 */
export function CreditsView({
  credits,
  totals,
  persons,
  accounts,
  linkableAssets,
  mePersonId,
}: {
  credits: CreditListItem[];
  totals: CreditsTotals;
  persons: FormPerson[];
  accounts: { id: number; name: string }[];
  linkableAssets: { id: number; name: string }[];
  mePersonId: number | null;
}) {
  const [adding, setAdding] = useState(false);
  // The date the household stops paying anything at all.
  const lastEnd = credits
    .map((c) => c.summary?.endDate)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Crédits
          </Title>
          <Text type="secondary">
            Ce qu&apos;il reste à rembourser, ce que cela coûte vraiment, et ce que vous
            possédez déjà des biens financés.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
          Ajouter un crédit
        </Button>
      </Flex>

      {totals.count > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}>
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
          <Col xs={12} lg={6}>
            <Card size="small">
              <Statistic title="Échéances" value={formatCents(totals.monthlyPaymentCents)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {totals.monthlyTotalCents > totals.monthlyPaymentCents
                  ? `+ ${formatCents(totals.monthlyTotalCents - totals.monthlyPaymentCents)} d'assurance = ${formatCents(totals.monthlyTotalCents)}`
                  : "hors assurance"}
              </Text>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card size="small">
              <Statistic title="Coût du crédit" value={formatCents(totals.totalCostCents)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                intérêts, assurance et frais
              </Text>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Libéré le"
                value={lastEnd ? formatDateShort(lastEnd) : "—"}
                valueStyle={{ fontSize: 22 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                dernière échéance connue
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      {credits.length === 0 ? (
        <Card>
          <Empty
            description="Aucun crédit enregistré"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <Flex vertical gap={16}>
          {credits.map((item) => (
            <CreditCard key={item.credit.id} item={item} />
          ))}
        </Flex>
      )}

      <AssetForm
        open={adding}
        onOpenChange={setAdding}
        accounts={accounts}
        persons={persons}
        mePersonId={mePersonId}
        defaultKind="liability"
        lockKind
        linkableAssets={linkableAssets}
      />
    </Flex>
  );
}
