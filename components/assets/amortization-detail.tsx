"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Col, Flex, Progress, Row, Table, Tag, Typography, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  amortizationSchedule,
  summarizeLoan,
  type AmortizationRow,
  type LoanSummary,
  type Prepayment,
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
  prepayments,
}: {
  asset: AssetRow;
  defaultOpen?: boolean;
  /** Capital repaid ahead of schedule, so the table shows the loan as it is. */
  prepayments?: Prepayment[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();

  // Everything below is computed before the early returns so the hooks that
  // follow run on every render — React requires the same hook order each time.
  const today = todayIso();
  const hasTerms =
    asset.principalCents != null && asset.interestRateBps != null && !!asset.termMonths;
  const loan = hasTerms
    ? {
        principalCents: asset.principalCents as number,
        interestRateBps: asset.interestRateBps as number,
        termMonths: asset.termMonths as number,
        monthlyPaymentCents: asset.monthlyPaymentCents,
        insuranceMonthlyCents: asset.insuranceMonthlyCents,
        feesCents: asset.feesCents,
        startDate: asset.startDate,
        prepayments,
      }
    : null;
  const schedule = loan ? amortizationSchedule(loan) : [];
  const summary = loan ? summarizeLoan(loan, today) : null;

  /**
   * The instalment that is next due — the row worth looking at.
   *
   * Past instalments are history; the last row is the end of the loan. Where
   * you are now is what you came to see, so that is what the table scrolls to
   * and highlights.
   */
  const currentIndex = Math.max(
    0,
    schedule.findIndex((r) => r.date !== null && r.date > today),
  );

  /**
   * Put the current row third, so the two instalments just paid stay visible
   * above it — landing on it at the very top hides the context that makes it
   * readable.
   */
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let tries = 0;

    // antd lays the scroll body out after mount, so the first frame has no
    // measurable rows and setting scrollTop then does nothing. Retry across a
    // few frames until the body is actually scrollable, and anchor on the row
    // element rather than a multiplied row height, which drifts once a row
    // wraps to two lines.
    const place = () => {
      const body = bodyRef.current?.querySelector<HTMLElement>(".ant-table-body");
      const rows = body?.querySelectorAll<HTMLElement>("tbody tr.ant-table-row");
      const target = rows?.[currentIndex];
      if (body && target && body.scrollHeight > body.clientHeight) {
        body.scrollTop = Math.max(0, target.offsetTop - 2 * target.offsetHeight);
        return;
      }
      if (tries++ < 40) frame = requestAnimationFrame(place);
    };

    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [open, currentIndex]);

  if (!loan) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        Renseignez capital, taux et durée pour voir l&apos;échéancier.
      </Text>
    );
  }
  if (schedule.length === 0 || !summary) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        Échéancier indisponible.
      </Text>
    );
  }

  const { progress } = summary;
  // Flag a drift worth acting on — ignore the cents of rounding.
  const staleBalance =
    progress != null &&
    Math.abs(asset.valueCents - progress.principalRemainingCents) >
      Math.max(10_000, loan.principalCents * 0.01);

  const columns: ColumnsType<AmortizationRow> = [
    {
      title: "#",
      dataIndex: "index",
      width: 92,
      render: (n: number, _r, i) =>
        i === currentIndex ? (
          // Named as well as tinted: the highlight must not be colour alone.
          <Flex align="center" gap={6}>
            <span>{n}</span>
            <Tag color="processing" bordered={false} style={{ marginInlineEnd: 0, fontSize: 11 }}>
              à venir
            </Tag>
          </Flex>
        ) : (
          n
        ),
    },
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
        <div ref={bodyRef}>
          <Table
            rowKey="index"
            size="small"
            columns={columns}
            dataSource={schedule}
            pagination={false}
            // Hundreds of instalments: scroll the body, not the page. Tall
            // enough to show roughly a year at a time.
            scroll={{ y: 460 }}
            onRow={(_r, i) =>
              i === currentIndex
                ? {
                    style: {
                      background: token.colorPrimaryBg,
                      boxShadow: `inset 3px 0 0 ${token.colorPrimary}`,
                      fontWeight: 600,
                    },
                  }
                : (i ?? 0) < currentIndex
                  ? { style: { color: token.colorTextTertiary } }
                  : {}
            }
          />
        </div>
      )}
    </Flex>
  );
}
