"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Alert, Button, Card, Flex, Popconfirm, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { formatCents, formatDateLong, formatDateShort, formatNumber } from "@shared/format";
import { PROPERTY_CONDITION_LABELS } from "@domain/enums";
import type { AssetRow, EstimationRow } from "@domain/entities";

const { Text } = Typography;

/**
 * The day an estimate was taken, as an ISO date.
 *
 * `createdAt` is a `Date` on the server and survives the crossing as one, but
 * a client that got it as JSON has a string. `toString()` on the Date would
 * give "Sat Aug 23 2026", whose first ten characters are not a date at all.
 */
function day(value: Date | string): string {
  return (typeof value === "string" ? value : value.toISOString()).slice(0, 10);
}

/** An adjustment reads as a movement, so it always carries its sign. */
function signed(cents: number): string {
  return `${cents > 0 ? "+" : "−"}${formatCents(Math.abs(cents))}`;
}

/**
 * What the neighbours sold for, kept.
 *
 * Deliberately a button rather than something the page works out for you: the
 * estimate is drawn from public data held elsewhere, so asking for it sends
 * the address off the machine. That should be a decision, and it should be
 * visible that it was one — hence the line saying so before you press it.
 *
 * Which is why every answer is recorded. Recomputing to look at a figure you
 * already have would send the address again for nothing, so the page renders
 * the last estimate from the database and reaches out only when asked. The
 * side effect is a history: a property's value is a slow-moving thing, and
 * three dated figures say more about it than the newest one alone.
 *
 * The figure comes with its own margins. A median over a dozen sales is an
 * order of magnitude, not a valuation, and printing one number alone would
 * claim otherwise. When either adjustment applies the breakdown is shown
 * rather than folded in: the two are not equally solid — the plot is measured
 * and fitted against local sales, the condition is the owner's own word — and
 * a single total would hide which part of it is which.
 *
 * Each row is read back with the surface and plot it was computed on, not with
 * today's. A property gains a veranda and loses a hectare; an old figure read
 * against new inputs would be a different property's estimate.
 */
export function EstimationCard({
  asset,
  estimations,
}: {
  asset: AssetRow;
  estimations: EstimationRow[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const ready = !!asset.address?.trim() && !!asset.surfaceM2 && !!asset.propertyKind;
  const latest = estimations[0] ?? null;
  const older = estimations.slice(1);

  async function run() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}/estimations`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { status?: string; error?: string }
        | null;
      if (!res.ok) {
        message.error(data?.error ?? "Estimation impossible");
        return;
      }
      if (data?.status !== "ok") {
        setNotice(
          "Trop peu de biens de taille voisine ont changé de main autour de cette adresse ces dernières années pour en tirer un prix.",
        );
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(estimationId: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/estimations/${estimationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        message.error("Échec de la suppression");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function apply(valueCents: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valueCents }),
      });
      if (!res.ok) {
        message.error("Échec de l'enregistrement");
        return;
      }
      message.success("Valeur mise à jour");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      size="small"
      title="Estimation"
      extra={
        ready && (
          <Button size="small" loading={busy} onClick={run}>
            {latest ? "Réestimer" : "Estimer"}
          </Button>
        )
      }
    >
      {!ready ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Renseignez l&apos;adresse, le type de bien et la surface dans « Modifier » pour estimer ce
          bien d&apos;après les ventes enregistrées autour de lui.
        </Text>
      ) : (
        <Flex vertical gap={12}>
          {notice && <Alert type="info" showIcon message="Pas assez de ventes comparables" description={notice} />}

          {!latest ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              D&apos;après les ventes enregistrées autour de cette adresse (données publiques DVF).
              L&apos;adresse n&apos;est envoyée que lorsque vous cliquez.
            </Text>
          ) : (
            <>
              <Flex vertical gap={10}>
                <Flex align="baseline" gap={10} wrap>
                  <Text strong style={{ fontSize: 24, fontVariantNumeric: "tabular-nums" }}>
                    {formatCents(latest.valueCents)}
                  </Text>
                  <Text type="secondary">soit {formatCents(latest.pricePerM2Cents)}/m²</Text>
                </Flex>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Estimée le {formatDateLong(day(latest.createdAt))} sur{" "}
                  {formatNumber(latest.surfaceM2)} m² bâtis
                  {latest.landM2 ? ` et ${formatNumber(latest.landM2)} m² de terrain` : ""}.
                </Text>

                {(latest.landAdjustmentCents !== 0 || latest.conditionAdjustmentCents !== 0) && (
                  <Flex vertical gap={2}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ventes comparables {formatCents(latest.marketCents)}
                    </Text>
                    {latest.landAdjustmentCents !== 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Terrain de {formatNumber(latest.creditedLandM2!)} m² contre{" "}
                        {formatNumber(latest.comparableLandM2!)} m² alentour{" "}
                        {signed(latest.landAdjustmentCents)}
                        {latest.creditedLandM2! < (latest.landM2 ?? 0) && (
                          <>
                            {" "}
                            · retenu sur les {formatNumber(latest.landM2!)} m² du bien : aucune
                            vente voisine ne porte sur un terrain plus grand, le prix au m² au-delà
                            n&apos;est pas connu
                          </>
                        )}
                      </Text>
                    )}
                    {latest.conditionAdjustmentCents !== 0 && latest.condition && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        État « {PROPERTY_CONDITION_LABELS[latest.condition].toLowerCase()} », que
                        vous avez déclaré {signed(latest.conditionAdjustmentCents)}
                      </Text>
                    )}
                  </Flex>
                )}

                <Text type="secondary" style={{ fontSize: 12 }}>
                  Fourchette {formatCents(latest.lowCents)} – {formatCents(latest.highCents)} ·{" "}
                  {latest.sampleSize} ventes comparables dans un rayon de {latest.radiusM} m, entre{" "}
                  {formatDateShort(latest.oldestDate)} et {formatDateShort(latest.newestDate)}.
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {latest.address} · d&apos;après les valeurs foncières publiées (DVF).
                </Text>
              </Flex>

              <Flex gap={8} wrap align="center">
                <Button
                  size="small"
                  type="primary"
                  loading={busy}
                  disabled={latest.valueCents === asset.valueCents}
                  onClick={() => apply(latest.valueCents)}
                >
                  {latest.valueCents === asset.valueCents
                    ? "Valeur du bien"
                    : "Utiliser comme valeur"}
                </Button>
                <Popconfirm
                  title="Supprimer cette estimation ?"
                  okText="Supprimer"
                  cancelText="Annuler"
                  onConfirm={() => remove(latest.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Supprimer cette estimation"
                  />
                </Popconfirm>
              </Flex>
            </>
          )}

          {older.length > 0 && (
            <Flex vertical gap={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Estimations précédentes
              </Text>
              {older.map((e) => (
                <Flex key={e.id} justify="space-between" align="center" gap={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDateShort(day(e.createdAt))}
                  </Text>
                  <Flex align="center" gap={4}>
                    <Text style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {formatCents(e.valueCents)}
                    </Text>
                    <Popconfirm
                      title="Supprimer cette estimation ?"
                      okText="Supprimer"
                      cancelText="Annuler"
                      onConfirm={() => remove(e.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="Supprimer cette estimation"
                      />
                    </Popconfirm>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          )}
        </Flex>
      )}
    </Card>
  );
}
