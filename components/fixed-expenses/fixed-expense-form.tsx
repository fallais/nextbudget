"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Col, Form, Input, InputNumber, Modal, Row, Select, Switch } from "antd";
import type { FormInstance } from "antd";
import type { CategoryRow, FixedExpenseRow } from "@domain/entities";

type Values = {
  name: string;
  matchPattern: string;
  expectedAmount: number;
  dueDay: number | null;
  categoryId: number | null;
  tolerancePct: number;
  isActive: boolean;
};

/**
 * Create or edit a recurring charge.
 *
 * The matching pattern is asked for right under the name because it is the
 * field that makes the rest work: without it the charge is a number you typed,
 * with it the app can tell you whether it was actually paid.
 */
export function FixedExpenseFormBody({
  expense,
  categories,
  onDone,
  footer,
  formRef,
}: {
  expense?: FixedExpenseRow | null;
  categories: CategoryRow[];
  onDone?: (id: number | null) => void;
  footer?: (submitting: boolean) => React.ReactNode;
  formRef?: (form: FormInstance<Values>) => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const editing = !!expense;

  const initial: Values = {
    name: expense?.name ?? "",
    matchPattern: expense?.matchPattern ?? "",
    expectedAmount: expense ? expense.expectedAmountCents / 100 : 0,
    dueDay: expense?.dueDay ?? null,
    categoryId: expense?.categoryId ?? null,
    tolerancePct: expense?.tolerancePct ?? 10,
    isActive: expense?.isActive ?? true,
  };

  async function submit(v: Values) {
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/fixed-expenses/${expense!.id}` : "/api/fixed-expenses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: v.name,
            categoryId: v.categoryId ?? null,
            expectedAmountCents: Math.round(v.expectedAmount * 100),
            dueDay: v.dueDay ?? null,
            matchPattern: v.matchPattern,
            matchType: "contains" as const,
            tolerancePct: v.tolerancePct,
            isActive: v.isActive,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(data?.error ?? "Échec de l'enregistrement");
        return;
      }
      const created = editing
        ? null
        : ((await res.json().catch(() => null)) as { id?: number } | null);
      message.success(editing ? "Charge modifiée" : "Charge créée");
      onDone?.(created?.id ?? expense?.id ?? null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  formRef?.(form);

  return (
    <Form form={form} layout="vertical" initialValues={initial} onFinish={submit}>
      <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
        <Input autoFocus placeholder="Loyer" />
      </Form.Item>
      <Form.Item
        name="matchPattern"
        label="Motif de rapprochement"
        tooltip="Le texte cherché dans le libellé des transactions pour retrouver ce paiement."
        rules={[{ required: true, message: "Motif requis" }]}
      >
        <Input placeholder="EDF" />
      </Form.Item>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item
            name="expectedAmount"
            label="Montant attendu"
            rules={[{ required: true, message: "Montant requis" }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="dueDay" label="Jour d'échéance">
            <InputNumber style={{ width: "100%" }} min={1} max={31} placeholder="5" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="categoryId" label="Catégorie">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Aucune"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="tolerancePct"
            label="Tolérance"
            tooltip="Au-delà de cet écart, le montant payé est signalé comme inhabituel."
          >
            <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
          </Form.Item>
        </Col>
      </Row>
      {editing && (
        <Form.Item
          name="isActive"
          label="Suivie"
          valuePropName="checked"
          tooltip="Une charge en pause reste enregistrée mais n'est plus attendue ni comptée."
        >
          <Switch />
        </Form.Item>
      )}
      {footer && <div style={{ marginTop: 8 }}>{footer(saving)}</div>}
    </Form>
  );
}

export function FixedExpenseForm({
  open,
  onOpenChange,
  ...props
}: Parameters<typeof FixedExpenseFormBody>[0] & {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<FormInstance<Values> | null>(null);

  return (
    <Modal
      open={open}
      title={props.expense ? "Modifier la charge" : "Nouvelle charge fixe"}
      onCancel={() => onOpenChange(false)}
      onOk={() => form?.submit()}
      okText="Enregistrer"
      cancelText="Annuler"
      destroyOnHidden
    >
      <FixedExpenseFormBody
        {...props}
        formRef={setForm}
        onDone={(id) => {
          onOpenChange(false);
          props.onDone?.(id);
        }}
      />
    </Modal>
  );
}
