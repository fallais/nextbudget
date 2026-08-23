"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Col, Empty, Flex, Row, Segmented, Statistic, Typography, theme } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatBps, TOTAL_BPS } from "@domain/value-objects/share";
import { formatCents } from "@shared/format";
import { MONEY } from "@shared/palette";
import { PageHeader } from "@/components/layout/page-header";
import { AssetItemRow } from "./asset-row";
import type { FormPerson } from "./asset-form";
import type { AssetRow } from "@domain/entities";
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

const ALL = "all";

/**
 * Patrimoine: what you own, what you owe, and the difference.
 *
 * One selector governs the whole page. Previously the household total and the
 * per-person split sat side by side, which asks you to hold two different
 * scopes in your head at once; now you pick a scope and everything — the net
 * worth, the composition, the list — answers for it.
 *
 * Structure mirrors Crédits down to the summary: four tiles rather than one
 * dense card. The card it replaces stacked a headline, two figures, a two-tone
 * bar and a ranked list, and the bar was the worst of it — two segments of one
 * hue separated by opacity, identifiable only by hovering them.
 */
export function PatrimoineView({
  assets,
  persons,
  sharesByAsset,
  accounts: _accounts,
  mePersonId: _mePersonId,
}: {
  assets: AssetRow[];
  persons: FormPerson[];
  sharesByAsset: Record<number, OwnerShareRow[]>;
  accounts: { id: number; name: string }[];
  mePersonId: number | null;
}) {
  const { token } = theme.useToken();
  const [scope, setScope] = useState<string>(ALL);

  const nameOf = (id: number) => persons.find((p) => p.id === id)?.name ?? "—";

  /** The slice of an item that belongs to the selected scope. */
  function shareOf(asset: AssetRow): number {
    if (scope === ALL) return asset.valueCents;
    const bps = sharesByAsset[asset.id]?.find((o) => o.personId === Number(scope))?.shareBps ?? 0;
    return Math.round((asset.valueCents * bps) / TOTAL_BPS);
  }

  /** "Alex 50 % · Camille 50 %", only where a split is worth stating. */
  function shareLabel(asset: AssetRow): string | null {
    if (persons.length < 2 || scope !== ALL) return null;
    const rows = sharesByAsset[asset.id];
    if (!rows?.length || (rows.length === 1 && rows[0].shareBps === TOTAL_BPS)) return null;
    return rows.map((o) => `${nameOf(o.personId)} ${formatBps(o.shareBps)}`).join(" · ");
  }

  const visible = useMemo(
    () => assets.map((a) => ({ asset: a, cents: shareOf(a) })).filter((r) => r.cents > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, scope, sharesByAsset],
  );

  const assetsTotal = visible
    .filter((r) => r.asset.kind === "asset")
    .reduce((s, r) => s + r.cents, 0);
  const debtsTotal = visible
    .filter((r) => r.asset.kind === "liability")
    .reduce((s, r) => s + r.cents, 0);
  const net = assetsTotal - debtsTotal;
  // Debt against what is owned, which is what "part financée par emprunt"
  // means. The card used to divide it by assets *plus* debts, so a household
  // owing 100 k€ on 300 k€ of property was told it owed 25% of what it owned
  // rather than a third.
  const debtRatio = assetsTotal > 0 ? (debtsTotal / assetsTotal) * 100 : null;

  /** What the wealth is made of, biggest first. */
  const composition = useMemo(() => {
    const byType = new Map<string, number>();
    // Every asset the "Actifs" tile counts, or the shares are shares of a
    // total that is not on the page and they quietly stop summing to 100%.
    for (const r of visible.filter((x) => x.asset.kind === "asset")) {
      byType.set(r.asset.type, (byType.get(r.asset.type) ?? 0) + r.cents);
    }
    return [...byType.entries()]
      .map(([type, cents]) => ({ type, cents }))
      .sort((a, b) => b.cents - a.cents);
  }, [visible]);

  const owned = visible.filter((r) => r.asset.kind === "asset");
  const owed = visible.filter((r) => r.asset.kind === "liability");

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Patrimoine" }]}
        description="Ce que vous possédez, ce que vous devez, et la différence."
        actions={
          <Flex gap={12} align="center" wrap>
            {persons.length > 1 && (
              <Segmented
                value={scope}
                onChange={(v) => setScope(String(v))}
                options={[
                  { value: ALL, label: "Le foyer" },
                  ...persons.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            )}
            <Link href="/patrimoine/nouveau">
              <Button type="primary" icon={<PlusOutlined />}>
                Ajouter
              </Button>
            </Link>
          </Flex>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              title={`Valeur nette${scope !== ALL ? ` · ${nameOf(Number(scope))}` : ""}`}
              value={formatCents(net)}
              valueStyle={net < 0 ? { color: MONEY.expense } : undefined}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              ce que vous possédez moins ce que vous devez
            </Text>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic title="Actifs" value={formatCents(assetsTotal)} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {owned.length} bien{owned.length > 1 ? "s" : ""}
            </Text>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            {/* The minus stays on the figure: the palette's own rule is that
                red is reinforcement, never the only thing carrying the sign. */}
            <Statistic
              title="Passifs"
              value={debtsTotal > 0 ? `−${formatCents(debtsTotal)}` : formatCents(0)}
              valueStyle={debtsTotal > 0 ? { color: MONEY.expense } : undefined}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {owed.length} dette{owed.length > 1 ? "s" : ""}
            </Text>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Financé par emprunt"
              value={debtRatio === null ? "—" : `${Math.round(debtRatio)} %`}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {debtRatio === null
                ? "aucun actif à financer"
                : "de vos actifs restent à rembourser"}
            </Text>
          </Card>
        </Col>
      </Row>

      {composition.length > 0 && (
        <Card size="small" title="Composition des actifs">
          <Flex vertical gap={12}>
            {composition.map((c) => {
              const pct = assetsTotal > 0 ? (c.cents / assetsTotal) * 100 : 0;
              return (
                <Flex key={c.type} vertical gap={5}>
                  <Flex justify="space-between" align="baseline" gap={12}>
                    <Text style={{ fontSize: 13 }}>{TYPE_LABELS[c.type] ?? c.type}</Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCents(c.cents)} · {Math.round(pct)} %
                    </Text>
                  </Flex>
                  {/* One hue at one strength, length carrying the magnitude.
                      Shading these by rank meant a type changed colour when the
                      scope changed and reordered the list. */}
                  <div
                    style={{ height: 6, background: token.colorFillSecondary, borderRadius: 3 }}
                  >
                    <div
                      style={{
                        width: `${Math.max(pct, 1)}%`,
                        height: "100%",
                        background: token.colorPrimary,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </Flex>
              );
            })}
          </Flex>
        </Card>
      )}

      {visible.length === 0 ? (
        <Card>
          <Empty
            description={
              scope === ALL
                ? "Aucun élément de patrimoine"
                : `Rien n'est rattaché à ${nameOf(Number(scope))}`
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <>
          {owned.length > 0 && (
            <Section title="Actifs" count={owned.length}>
              {owned.map((r) => (
                <AssetItemRow
                  key={r.asset.id}
                  asset={r.asset}
                  shareCents={r.cents}
                  shareLabel={shareLabel(r.asset)}
                />
              ))}
            </Section>
          )}
          {owed.length > 0 && (
            <Section title="Passifs" count={owed.length}>
              {owed.map((r) => (
                <AssetItemRow
                  key={r.asset.id}
                  asset={r.asset}
                  shareCents={r.cents}
                  shareLabel={shareLabel(r.asset)}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </Flex>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Flex vertical gap={8}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {title} ({count})
      </Text>
      <Flex vertical gap={8}>
        {children}
      </Flex>
    </Flex>
  );
}

