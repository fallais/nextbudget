"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Col, Form, Input, InputNumber, Modal, Row, Select, Switch } from "antd";
import type { FormInstance } from "antd";
import type { CategoryRow, FixedExpenseRow } from "@domain/entities";
import {
  EXPENSE_CADENCES,
  EXPENSE_CADENCE_LABELS,
  needsDueMonth,
  type ExpenseCadence,
} from "@domain/enums";
import { formatMonthName } from "@shared/format";

export type Values = {
  name: string;
  matchPattern: string;
  /** Per occurrence: a yearly premium is the whole premium, not a twelfth. */
  expectedAmount: number;
  cadence: ExpenseCadence;
  dueDay: number | null;
  dueMonth: number | null;
  categoryId: number | null;
  tolerancePct: number;
  isActive: boolean;
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: formatMonthName(i + 1),
}));

/**
 * Values a suggested charge arrives with, before anyone has confirmed it.
 *
 * A detected charge is an offer, so it fills the form rather than writing a
 * row: the amount is a median and the pattern a guess, and both are easier to
 * correct here than to notice later on a page that says a charge was never
 * paid.
 */
export type FixedExpenseDraft = Partial<Values>;

/**
 * Create or edit a recurring charge.
 *
 * The matching pattern is asked for right under the name because it is the
 * field that makes the rest work: without it the charge is a number you typed,
 * with it the app can tell you whether it was actually paid.
 */
export function FixedExpenseFormBody({
  expense,
  draft,
  categories,
  onDone,
  footer,
  formRef,
}: {
  expense?: FixedExpenseRow | null;
  draft?: FixedExpenseDraft;
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
  // Watched, because which fields make sense depends on it: a weekly charge
  // has no day of the month, and a quarterly one is nowhere without its anchor.
  const cadence: ExpenseCadence =
    Form.useWatch("cadence", form) ?? expense?.cadence ?? draft?.cadence ?? "monthly";

  const initial: Values = {
    name: expense?.name ?? "",
    matchPattern: expense?.matchPattern ?? "",
    expectedAmount: expense ? expense.expectedAmountCents / 100 : 0,
    cadence: expense?.cadence ?? "monthly",
    dueDay: expense?.dueDay ?? null,
    dueMonth: expense?.dueMonth ?? null,
    categoryId: expense?.categoryId ?? null,
    tolerancePct: expense?.tolerancePct ?? 10,
    isActive: expense?.isActive ?? true,
    ...draft,
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
            cadence: v.cadence,
            dueDay: v.cadence === "weekly" ? null : (v.dueDay ?? null),
            dueMonth: needsDueMonth(v.cadence) ? (v.dueMonth ?? null) : null,
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
            name="cadence"
            label="Fréquence"
            tooltip="À quel rythme la charge revient. Le montant demandé est celui d'un prélèvement, pas d'un mois."
          >
            <Select
              options={EXPENSE_CADENCES.map((c) => ({
                value: c,
                label: EXPENSE_CADENCE_LABELS[c],
              }))}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="expectedAmount"
            label={cadence === "monthly" ? "Montant attendu" : "Montant par prélèvement"}
            rules={[{ required: true, message: "Montant requis" }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
          </Form.Item>
        </Col>
      </Row>
      {cadence !== "weekly" && (
        <Row gutter={12}>
          {needsDueMonth(cadence) && (
            <Col span={12}>
              <Form.Item
                name="dueMonth"
                label={cadence === "yearly" ? "Mois de l'échéance" : "Mois du 1er trimestre"}
                tooltip={
                  cadence === "yearly"
                    ? "Le mois où la charge tombe chaque année."
                    : "Le mois d'un des prélèvements : les suivants tombent tous les trois mois à partir de là."
                }
                rules={[{ required: true, message: "Mois requis" }]}
              >
                <Select options={MONTH_OPTIONS} placeholder="octobre" />
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item name="dueDay" label="Jour d'échéance">
              <InputNumber style={{ width: "100%" }} min={1} max={31} placeholder="5" />
            </Form.Item>
          </Col>
        </Row>
      )}
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
