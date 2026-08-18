"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Empty, Flex, Segmented, Tooltip, Typography, theme } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatBps, TOTAL_BPS } from "@domain/value-objects/share";
import { formatCents } from "@shared/format";
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
 * Structure mirrors Crédits: a summary card, then the items as rows that lead
 * to their own page.
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
  const gross = assetsTotal + debtsTotal;
  const assetsShare = gross > 0 ? (assetsTotal / gross) * 100 : 100;

  /** What the wealth is made of, biggest first. */
  const composition = useMemo(() => {
    const byType = new Map<string, number>();
    for (const r of visible.filter((x) => x.asset.kind === "asset" && x.asset.isActive)) {
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
          <Link href="/patrimoine/nouveau">
            <Button type="primary" icon={<PlusOutlined />}>
              Ajouter
            </Button>
          </Link>
        }
      />

      {/* One card: the net worth, the subtraction behind it, and what the
          assets are made of — they answer the same question and were two
          cards asking you to look twice. */}
      <Card>
        <Flex vertical gap={16}>
          <Flex justify="space-between" align="flex-start" wrap gap={16}>
            <Flex vertical gap={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Valeur nette{scope !== ALL && ` · ${nameOf(Number(scope))}`}
              </Text>
              <Text strong style={{ fontSize: 34, fontVariantNumeric: "tabular-nums" }}>
                {formatCents(net)}
              </Text>
            </Flex>

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
          </Flex>

          <Flex gap={32} wrap>
            <Figure label="Actifs" value={formatCents(assetsTotal)} />
            <Figure label="Passifs" value={`−${formatCents(debtsTotal)}`} />
          </Flex>

          {gross > 0 && (
            <Flex vertical gap={6}>
              <Flex style={{ width: "100%", height: 12, gap: 2 }}>
                <Tooltip title={`Actifs ${formatCents(assetsTotal)}`}>
                  <div
                    style={{ width: `${assetsShare}%`, background: token.colorPrimary, borderRadius: 4 }}
                  />
                </Tooltip>
                <Tooltip title={`Passifs ${formatCents(debtsTotal)}`}>
                  <div
                    style={{
                      width: `${100 - assetsShare}%`,
                      background: token.colorPrimary,
                      opacity: 0.28,
                      borderRadius: 4,
                    }}
                  />
                </Tooltip>
              </Flex>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Les dettes représentent {Math.round(100 - assetsShare)} % de ce qui est possédé.
              </Text>
            </Flex>
          )}

          {composition.length > 0 && (
            <Flex vertical gap={10} style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 14 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Composition des actifs
              </Text>
              {composition.map((c, i) => {
                const pct = assetsTotal > 0 ? Math.round((c.cents / assetsTotal) * 100) : 0;
                return (
                  <Flex key={c.type} vertical gap={4}>
                    <Flex justify="space-between" align="baseline">
                      <Text style={{ fontSize: 13 }}>{TYPE_LABELS[c.type] ?? c.type}</Text>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatCents(c.cents)} · {pct} %
                      </Text>
                    </Flex>
                    {/* One hue, stepped by rank — the ramp carries the order. */}
                    <div style={{ height: 6, background: token.colorFillSecondary, borderRadius: 3 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: token.colorPrimary,
                          opacity: Math.max(0.35, 1 - i * 0.18),
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </Flex>
                );
              })}
            </Flex>
          )}
        </Flex>
      </Card>

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
