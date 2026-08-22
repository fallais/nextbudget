"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { App, Button, Card, Col, Flex, Popconfirm, Row, Typography, theme } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { formatBps, TOTAL_BPS } from "@domain/value-objects/share";
import { formatCents, formatDateShort } from "@shared/format";
import { PageHeader } from "@/components/layout/page-header";
import { AssetForm, type FormPerson } from "./asset-form";
import { AmortizationDetail } from "./amortization-detail";
import { EstimationCard } from "./estimation-card";
import type { AssetRow } from "@domain/entities";
import type { AssetOwnerInput } from "@domain/repositories";
import type { OwnerShareRow } from "@domain/value-objects/share";

const { Text } = Typography;

const TYPE_LABELS: Record<string, string> = {
  real_estate: "Immobilier",
  vehicle: "Véhicule",
  savings: "Épargne",
  investment: "Investissement",
  loan: "Prêt",
  mortgage: "Crédit immobilier",
  other: "Autre",
};

/**
 * One item of the patrimoine in full — the same shape as a credit's page, so
 * the two read alike: breadcrumb and actions, a summary card, then whatever
 * else this particular item has to say.
 */
export function AssetDetail({
  asset,
  shares,
  owners,
  persons,
  accounts,
  linkableAssets,
  linkedCredit,
  financedAsset,
  mePersonId,
}: {
  asset: AssetRow;
  shares: OwnerShareRow[];
  owners: AssetOwnerInput[];
  persons: FormPerson[];
  accounts: { id: number; name: string }[];
  linkableAssets: { id: number; name: string }[];
  /** A loan financing this asset, when one points at it. */
  linkedCredit: Pick<AssetRow, "id" | "name" | "valueCents"> | null;
  /** The asset this item finances, when it is itself a loan. */
  financedAsset: Pick<AssetRow, "id" | "name" | "valueCents"> | null;
  mePersonId: number | null;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  const isDebt = asset.kind === "liability";
  const nameOf = (id: number) => persons.find((p) => p.id === id)?.name ?? "—";

  async function remove() {
    const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    message.success("Supprimé");
    router.push("/patrimoine");
    router.refresh();
  }

  // What is actually yours of this thing, once the loan against it is deducted.
  const equity = linkedCredit ? asset.valueCents - linkedCredit.valueCents : null;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Patrimoine", href: "/patrimoine" }, { label: asset.name }]}
        actions={
          <Flex gap={8}>
            <Button icon={<EditOutlined />} onClick={() => setOpen(true)}>
              Modifier
            </Button>
            <Popconfirm
              title={`Supprimer « ${asset.name} » ?`}
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
        <Row gutter={[28, 16]}>
          <Col xs={12} md={8}>
            <Figure
              label={isDebt ? "Capital restant dû" : "Valeur"}
              value={`${isDebt ? "−" : ""}${formatCents(asset.valueCents)}`}
              big
            />
          </Col>
          <Col xs={12} md={8}>
            <Figure label="Type" value={TYPE_LABELS[asset.type] ?? asset.type} />
          </Col>
          {asset.accountId && (
            <Col xs={12} md={8}>
              <Figure
                label="Compte associé"
                value={accounts.find((a) => a.id === asset.accountId)?.name ?? "—"}
              />
            </Col>
          )}
          {financedAsset && (
            <Col xs={24} md={8}>
              <Figure
                label="Finance"
                value={financedAsset.name}
                hint={`valorisé ${formatCents(financedAsset.valueCents)}`}
              />
            </Col>
          )}
          {asset.startDate && (
            <Col xs={12} md={8}>
              <Figure label="Début" value={formatDateShort(asset.startDate)} />
            </Col>
          )}
        </Row>

        {shares.length > 0 && persons.length > 1 && (
          <Flex
            vertical
            gap={8}
            style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 16, paddingTop: 14 }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Quotes-parts
            </Text>
            <Flex gap={28} wrap>
              {shares.map((o) => (
                <Figure
                  key={o.personId}
                  label={`${nameOf(o.personId)} · ${formatBps(o.shareBps)}`}
                  value={formatCents(Math.round((asset.valueCents * o.shareBps) / TOTAL_BPS))}
                />
              ))}
            </Flex>
          </Flex>
        )}
      </Card>

      {asset.kind === "asset" && asset.type === "real_estate" && (
        <EstimationCard asset={asset} />
      )}

      {/* A property with a mortgage against it: what is left once the debt is
          deducted is the number that actually matters. */}
      {linkedCredit && equity !== null && (
        <Card size="small" title="Ce que vous en possédez">
          <Flex vertical gap={8}>
            <Flex justify="space-between" align="baseline">
              <Text type="secondary" style={{ fontSize: 12 }}>
                Valeur moins <Link href={`/credits/${linkedCredit.id}`}>{linkedCredit.name}</Link>
              </Text>
              <Text strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 18 }}>
                {formatCents(equity)}
              </Text>
            </Flex>
            <Flex style={{ width: "100%", height: 12, gap: 2 }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, (equity / asset.valueCents) * 100))}%`,
                  background: token.colorPrimary,
                  borderRadius: 4,
                }}
              />
              <div style={{ flex: 1, background: token.colorPrimary, opacity: 0.28, borderRadius: 4 }} />
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatCents(linkedCredit.valueCents)} restent à rembourser sur{" "}
              {formatCents(asset.valueCents)}.
            </Text>
          </Flex>
        </Card>
      )}

      {isDebt && (
        <Card title="Échéancier">
          <AmortizationDetail asset={asset} defaultOpen />
        </Card>
      )}

      {asset.notes && (
        <Card size="small" title="Notes">
          <Text>{asset.notes}</Text>
        </Card>
      )}

      <AssetForm
        key={asset.id}
        open={open}
        onOpenChange={setOpen}
        asset={asset}
        accounts={accounts}
        persons={persons}
        owners={owners}
        mePersonId={mePersonId}
        defaultKind={asset.kind}
        linkableAssets={linkableAssets}
      />
    </Flex>
  );
}

function Figure({
  label,
  value,
  hint,
  big,
}: {
  label: string;
  value: string;
  hint?: string;
  big?: boolean;
}) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: big ? 26 : 16, fontVariantNumeric: "tabular-nums" }}>
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
