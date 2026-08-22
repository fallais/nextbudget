"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Alert, Button, Card, Flex, Typography } from "antd";
import { formatCents, formatDateShort } from "@shared/format";
import type { AssetRow } from "@domain/entities";
import type { Estimate } from "@domain/services/estimation";

const { Text } = Typography;

type Outcome =
  | { status: "ok"; estimate: Estimate; address: string }
  | { status: "too_few_sales" };

/**
 * What the neighbours sold for, on request.
 *
 * Deliberately a button rather than something the page works out for you: the
 * estimate is drawn from public data held elsewhere, so asking for it sends
 * the address off the machine. That should be a decision, and it should be
 * visible that it was one — hence the line saying so before you press it.
 *
 * The figure comes with its own margins. A median over a dozen sales is an
 * order of magnitude, not a valuation, and printing one number alone would
 * claim otherwise.
 */
export function EstimationCard({ asset }: { asset: AssetRow }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = !!asset.address?.trim() && !!asset.surfaceM2 && !!asset.propertyKind;

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/estimate`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as (Outcome & { error?: string }) | null;
      if (!res.ok) {
        message.error(data?.error ?? "Estimation impossible");
        return;
      }
      setOutcome(data as Outcome);
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
            {outcome ? "Réestimer" : "Estimer"}
          </Button>
        )
      }
    >
      {!ready ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Renseignez l&apos;adresse, le type de bien et la surface dans « Modifier » pour estimer ce
          bien d&apos;après les ventes enregistrées autour de lui.
        </Text>
      ) : outcome?.status === "ok" ? (
        <Flex vertical gap={10}>
          <Flex align="baseline" gap={10} wrap>
            <Text strong style={{ fontSize: 24, fontVariantNumeric: "tabular-nums" }}>
              {formatCents(outcome.estimate.valueCents)}
            </Text>
            <Text type="secondary">
              soit {formatCents(outcome.estimate.pricePerM2Cents)}/m²
            </Text>
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Fourchette {formatCents(outcome.estimate.lowCents)} –{" "}
            {formatCents(outcome.estimate.highCents)} · {outcome.estimate.sampleSize} ventes
            comparables dans un rayon de {outcome.estimate.radiusM} m, entre{" "}
            {formatDateShort(outcome.estimate.oldestDate)} et{" "}
            {formatDateShort(outcome.estimate.newestDate)}.
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {outcome.address} · d&apos;après les valeurs foncières publiées (DVF).
          </Text>
          <Flex>
            <Button
              size="small"
              type="primary"
              loading={busy}
              onClick={() => apply(outcome.estimate.valueCents)}
            >
              Utiliser comme valeur
            </Button>
          </Flex>
        </Flex>
      ) : outcome?.status === "too_few_sales" ? (
        <Alert
          type="info"
          showIcon
          message="Pas assez de ventes comparables"
          description="Trop peu de biens de taille voisine ont changé de main autour de cette adresse ces dernières années pour en tirer un prix."
        />
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          D&apos;après les ventes enregistrées autour de cette adresse (données publiques DVF).
          L&apos;adresse n&apos;est envoyée que lorsque vous cliquez.
        </Text>
      )}
    </Card>
  );
}
