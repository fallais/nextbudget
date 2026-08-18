"use client";

import { useState } from "react";
import { Alert, Button, Col, Flex, Progress, Row, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  amortizationSchedule,
  summarizeLoan,
  type AmortizationRow,
  type LoanSummary,
} from "@domain/services/amortization";
import { STATUS } from "@shared/palette";
import { formatCents, formatDateShort } from "@shared/format";
import type { AssetRow } from "@domain/entities";

const { Text } = Typography;

/** Local date, not UTC: an instalment falls on a calendar day, not an instant. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "42 000 € d'intérêts · 6 000 € d'assurance · 1 500 € de frais" */
function costBreakdown(s: LoanSummary): string {
  const parts = [`${formatCents(s.totalInterestCents)} d'intérêts`];
  if (s.totalInsuranceCents > 0) parts.push(`${formatCents(s.totalInsuranceCents)} d'assurance`);
  if (s.feesCents > 0) parts.push(`${formatCents(s.feesCents)} de frais`);
  return parts.join(" · ");
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
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

export function AmortizationDetail({
  asset,
  defaultOpen = false,
}: {
  asset: AssetRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (asset.principalCents == null || asset.interestRateBps == null || !asset.termMonths) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        Renseignez capital, taux et durée pour voir l&apos;échéancier.
      </Text>
    );
  }

  const loan = {
    principalCents: asset.principalCents,
    interestRateBps: asset.interestRateBps,
    termMonths: asset.termMonths,
    monthlyPaymentCents: asset.monthlyPaymentCents,
    insuranceMonthlyCents: asset.insuranceMonthlyCents,
    feesCents: asset.feesCents,
    startDate: asset.startDate,
  };
  const schedule = amortizationSchedule(loan);
  const summary = summarizeLoan(loan, todayIso());
  if (schedule.length === 0 || !summary) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        Échéancier indisponible.
      </Text>
    );
  }

  const { progress } = summary;
  const paidPct = progress
    ? Math.round((progress.principalPaidCents / asset.principalCents) * 100)
    : null;
  // Flag a drift worth acting on — ignore the cents of rounding.
  const staleBalance =
    progress != null &&
    Math.abs(asset.valueCents - progress.principalRemainingCents) >
      Math.max(10_000, asset.principalCents * 0.01);

  const columns: ColumnsType<AmortizationRow> = [
    { title: "#", dataIndex: "index", width: 56 },
    {
      title: "Date",
      dataIndex: "date",
      width: 110,
      render: (d: string | null) => (d ? formatDateShort(d) : "—"),
    },
    {
      title: "Capital",
      dataIndex: "principalCents",
      align: "right",
      render: (c: number) => formatCents(c),
    },
    {
      title: "Intérêts",
      dataIndex: "interestCents",
      align: "right",
      render: (c: number) => formatCents(c),
    },
    {
      title: "Restant",
      dataIndex: "balanceCents",
      align: "right",
      render: (c: number) => formatCents(c),
    },
  ];

  return (
    <Flex vertical gap={12}>
      {/* Deliberately only the schedule and the one thing it alone can say —
          that the stored balance has drifted from it. The échéance, the cost
          breakdown and the progress are already at the top of the page; a
          second copy here was just noise. */}
      {staleBalance && progress && (
        <Alert
          type="warning"
          showIcon
          message={`Le solde saisi (${formatCents(asset.valueCents)}) diffère de l'échéancier (${formatCents(progress.principalRemainingCents)}).`}
          description="Mettez-le à jour pour une valeur nette juste."
        />
      )}

      {!defaultOpen && (
        <div>
          <Button
            type="link"
            size="small"
            style={{ paddingInline: 0 }}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Masquer l'échéancier" : `Voir l'échéancier (${schedule.length} lignes)`}
          </Button>
        </div>
      )}

      {open && (
        <Table
          rowKey="index"
          size="small"
          columns={columns}
          dataSource={schedule}
          pagination={false}
          // Hundreds of instalments: scroll the body rather than the page.
          scroll={{ y: 260 }}
        />
      )}
    </Flex>
  );
}
