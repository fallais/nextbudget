"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, RiseOutlined } from "@ant-design/icons";
import { formatCents, formatDateShort, formatMonthLabel, titleCase } from "@shared/format";
import { STATUS } from "@shared/palette";
import type { RecurringCandidate } from "@application/recurring";

const { Text } = Typography;

const CADENCE_LABEL: Record<RecurringCandidate["recurrence"]["cadence"], string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

/**
 * Charges that repeat but were never written down.
 *
 * The list people most need is the one they never made: the subscription taken
 * out for one film, the insurance that renews itself, the gym nobody goes to.
 * All of it is already in the statements.
 *
 * Confirming opens the form rather than creating the charge, because the
 * amount is a median and the pattern a guess. Refusing is remembered, or the
 * same three suggestions would come back on every visit until the page stopped
 * being read.
 */
export function RecurringSuggestions({
  candidates,
  dismissedKeys,
}: {
  candidates: RecurringCandidate[];
  /** Already refused. Kept in sight, or refusing one would be irreversible. */
  dismissedKeys: string[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [restored, setRestored] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = candidates.filter((c) => !dismissed.includes(c.key));
  const ignored = [...new Set([...dismissedKeys, ...dismissed])].filter(
    (k) => !restored.includes(k),
  );
  if (rows.length === 0 && ignored.length === 0) return null;

  async function dismiss(candidate: RecurringCandidate) {
    setBusy(candidate.key);
    try {
      const res = await fetch("/api/recurring/dismissals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: candidate.key }),
      });
      if (!res.ok) {
        message.error("Échec");
        return;
      }
      // Dropped here as well as on the server: the row should go the moment it
      // is refused, not on the next render pass.
      setDismissed((keys) => [...keys, candidate.key]);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  /** Put a refused suggestion back in the list. */
  async function restore(key: string) {
    const res = await fetch(`/api/recurring/dismissals/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      message.error("Échec");
      return;
    }
    setRestored((keys) => [...keys, key]);
    setDismissed((keys) => keys.filter((k) => k !== key));
    router.refresh();
  }

  /** Everything the form needs, so confirming is a review rather than retyping. */
  function createHref(c: RecurringCandidate): string {
    const params = new URLSearchParams({
      name: titleCase(c.key),
      pattern: c.suggestedPattern,
      amountCents: String(c.recurrence.medianAmountCents),
      tolerancePct: String(c.suggestedTolerancePct),
    });
    if (c.recurrence.dueDay !== null) params.set("dueDay", String(c.recurrence.dueDay));
    if (c.category) params.set("categoryId", String(c.category.id));
    return `/frais-fixes/nouveau?${params.toString()}`;
  }

  const columns: ColumnsType<RecurringCandidate> = [
    {
      title: "Charge",
      dataIndex: "label",
      ellipsis: true,
      render: (_, c) => (
        <Flex vertical gap={2}>
          <Flex gap={8} align="center" wrap>
            <Text strong>{titleCase(c.key)}</Text>
            <Tag style={{ marginInlineEnd: 0 }}>{CADENCE_LABEL[c.recurrence.cadence]}</Tag>
            {c.drift && (
              <Tooltip
                title={`${formatCents(c.drift.fromCents)} → ${formatCents(c.drift.toCents)} depuis ${formatMonthLabel(c.drift.since.slice(0, 7))}`}
              >
                <Tag
                  icon={<RiseOutlined />}
                  color={c.drift.changePct > 0 ? STATUS.critical : STATUS.good}
                  style={{ marginInlineEnd: 0 }}
                >
                  {c.drift.changePct > 0 ? "+" : ""}
                  {c.drift.changePct.toFixed(0)} %
                </Tag>
              </Tooltip>
            )}
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {c.label}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Montant",
      dataIndex: ["recurrence", "medianAmountCents"],
      align: "right",
      width: 150,
      render: (_, c) => (
        <Flex vertical gap={0} align="flex-end">
          <Text style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCents(c.recurrence.medianAmountCents)}
          </Text>
          {c.recurrence.cadence !== "monthly" && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              soit {formatCents(c.monthlyCents)} / mois
            </Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Prochaine",
      dataIndex: ["recurrence", "nextDate"],
      width: 120,
      responsive: ["lg"],
      render: (_, c) => (
        <Text type="secondary">{formatDateShort(c.recurrence.nextDate)}</Text>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 190,
      align: "right",
      render: (_, c) => (
        <Flex gap={8} justify="flex-end">
          <Link href={createHref(c)}>
            <Button size="small" type="primary" icon={<PlusOutlined />}>
              Suivre
            </Button>
          </Link>
          <Button size="small" loading={busy === c.key} onClick={() => dismiss(c)}>
            Ignorer
          </Button>
        </Flex>
      ),
    },
  ];

  return (
    <Card
      title="Charges récurrentes repérées"
      extra={
        <Text type="secondary" style={{ fontSize: 12 }}>
          {rows.length > 0
            ? `${rows.length} non suivie${rows.length > 1 ? "s" : ""}`
            : "tout est suivi"}
        </Text>
      }
      styles={{ body: { padding: 0 } }}
    >
      {rows.length > 0 && (
        <Table
          rowKey="key"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={rows.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
        />
      )}

      {ignored.length > 0 && (
        <Flex gap={8} wrap align="center" style={{ padding: "10px 12px" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Ignorées :
          </Text>
          {ignored.map((key) => (
            <Tag key={key} closable onClose={() => restore(key)} style={{ marginInlineEnd: 0 }}>
              {titleCase(key)}
            </Tag>
          ))}
        </Flex>
      )}
    </Card>
  );
}
