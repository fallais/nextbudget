"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { formatCents, formatDateShort } from "@shared/format";
import { PREPAYMENT_MODE_LABELS } from "@domain/enums";
import type { PrepaymentRow } from "@domain/entities";

const { Text } = Typography;

/**
 * Capital paid off ahead of the schedule.
 *
 * Recorded rather than subtracted: the échéancier above is rebuilt around each
 * one, so the interest, the remaining instalments and — if the bank lowered it
 * — the instalment itself all follow. Typing a corrected balance into the loan
 * instead would be right for a day and wrong every day after.
 */
export function PrepaymentsCard({
  assetId,
  prepayments,
  hasStartDate,
}: {
  assetId: number;
  prepayments: PrepaymentRow[];
  hasStartDate: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = prepayments.reduce((a, p) => a + p.amountCents, 0);

  async function remove(id: number) {
    const res = await fetch(`/api/assets/${assetId}/prepayments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    router.refresh();
  }

  const columns: ColumnsType<PrepaymentRow> = [
    {
      title: "Date",
      width: 120,
      render: (_, p) => <Text type="secondary">{formatDateShort(p.date)}</Text>,
    },
    {
      title: "Montant",
      align: "right",
      width: 130,
      render: (_, p) => (
        <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(p.amountCents)}
        </Text>
      ),
    },
    {
      title: "Effet",
      width: 190,
      render: (_, p) => (
        <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
          {PREPAYMENT_MODE_LABELS[p.mode]}
        </Tag>
      ),
    },
    {
      title: "Indemnité",
      align: "right",
      width: 110,
      render: (_, p) => (
        <Text type="secondary" style={{ fontVariantNumeric: "tabular-nums" }}>
          {p.feesCents ? formatCents(p.feesCents) : "—"}
        </Text>
      ),
    },
    { title: "Note", render: (_, p) => <Text type="secondary">{p.notes ?? "—"}</Text> },
    {
      title: "",
      width: 44,
      align: "right",
      render: (_, p) => (
        <Popconfirm
          title="Supprimer ce remboursement ?"
          description="L'échéancier repart comme s'il n'avait pas eu lieu."
          okText="Supprimer"
          cancelText="Annuler"
          onConfirm={() => remove(p.id)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Supprimer" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="Remboursements anticipés"
      extra={
        <Flex align="center" gap={10}>
          {total > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatCents(total)} au total
            </Text>
          )}
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.setFieldsValue({ amount: null, date: null, mode: "duration", fees: null, notes: "" });
              setOpen(true);
            }}
          >
            Ajouter
          </Button>
        </Flex>
      }
      styles={{ body: { padding: prepayments.length ? 0 : 24 } }}
    >
      {prepayments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aucun remboursement anticipé enregistré"
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={prepayments}
          pagination={false}
        />
      )}

      <Modal
        open={open}
        title="Remboursement anticipé"
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ paddingTop: 8 }}
          onFinish={async (v) => {
            setBusy(true);
            try {
              const res = await fetch(`/api/assets/${assetId}/prepayments`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  date: (v.date as Dayjs).format("YYYY-MM-DD"),
                  amountCents: Math.round(((v.amount as number) ?? 0) * 100),
                  mode: v.mode as string,
                  feesCents: v.fees != null ? Math.round((v.fees as number) * 100) : null,
                  notes: (v.notes as string)?.trim() || null,
                }),
              });
              if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                message.error(data?.error ?? "Échec de l'enregistrement");
                return;
              }
              setOpen(false);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="amount"
            label="Capital remboursé"
            rules={[{ required: true, message: "Montant requis" }]}
            tooltip="Le versement exceptionnel, pas l'échéance du mois. Il n'a pas à solder le prêt."
          >
            <InputNumber style={{ width: "100%" }} min={0.01} step={1000} addonAfter="€" />
          </Form.Item>
          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: "Date requise" }]}
            extra={
              hasStartDate
                ? undefined
                : "Ce prêt n'a pas de première échéance : sans elle, l'échéancier ne peut pas placer le remboursement et l'ignorera."
            }
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="mode"
            label="Effet"
            tooltip="Ce que la banque a fait de la somme. Réduire la durée économise nettement plus d'intérêts ; réduire la mensualité allège tout de suite."
          >
            <Segmented
              block
              options={[
                { value: "duration", label: "Réduction de durée" },
                { value: "payment", label: "Réduction de mensualité" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="fees"
            label="Indemnité (IRA)"
            tooltip="L'indemnité de remboursement anticipé prélevée par la banque, le cas échéant. Comptée dans le coût du crédit."
          >
            <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" placeholder="0" />
          </Form.Item>
          <Form.Item name="notes" label="Note">
            <Input placeholder="Prime, héritage, vente…" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
