"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Flex, Form, InputNumber, Modal, Segmented, Select, Typography } from "antd";
import { monthlyEquivalentCents } from "@domain/entities/budget";
import { formatCents } from "@shared/format";
import type { FormInstance } from "antd";

const { Text } = Typography;

export type BudgetFormCategory = {
  id: number;
  name: string;
  color: string;
  /**
   * Why this category cannot take a budget, if it cannot. Two reasons exist —
   * it already has one, or a fixed expense already covers it — and both are
   * shown rather than hidden: a category missing from the list with no
   * explanation reads as a bug.
   */
  unavailable?: string | null;
};

export type EditableBudget = {
  id: number;
  categoryId: number;
  amountCents: number;
  period: "weekly" | "monthly";
};

type Values = {
  categoryId: number | null;
  amount: number | null;
  period: "weekly" | "monthly";
};

/**
 * Create or edit a budget.
 *
 * The category is picked *here*, when the budget is created — not by hunting
 * for the right row in a list of categories that already have one. On an
 * existing budget it is locked: a budget is a ceiling *for* a category, so
 * moving it elsewhere is deleting one budget and creating another, and doing
 * that silently would carry the spending history of the wrong category.
 */
export function BudgetFormBody({
  categories,
  budget,
  onDone,
  footer,
  formRef,
}: {
  categories: BudgetFormCategory[];
  budget?: EditableBudget | null;
  /** Called after a successful save, with the budget's id. */
  onDone?: (id: number | null) => void;
  /** Rendered at the bottom of the form when it is a page rather than a modal. */
  footer?: (submitting: boolean) => React.ReactNode;
  formRef?: (form: FormInstance<Values>) => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const editing = !!budget;

  const initial: Values = {
    categoryId: budget?.categoryId ?? null,
    amount: budget ? budget.amountCents / 100 : null,
    period: budget?.period ?? "monthly",
  };

  const amount = Form.useWatch("amount", form);
  const period = Form.useWatch("period", form) ?? initial.period;

  const available = categories.filter((c) => !c.unavailable);
  const nothingLeft = !editing && available.length === 0;

  async function submit(v: Values) {
    setSaving(true);
    try {
      const amountCents = Math.round((v.amount ?? 0) * 100);
      const res = await fetch(editing ? `/api/budgets/${budget!.id}` : "/api/budgets", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          editing
            ? { amountCents, period: v.period }
            : { categoryId: v.categoryId, amountCents, period: v.period },
        ),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(data?.error ?? "Échec de l'enregistrement");
        return;
      }
      const created = editing
        ? null
        : ((await res.json().catch(() => null)) as { id?: number } | null);
      message.success(editing ? "Budget modifié" : "Budget créé");
      onDone?.(created?.id ?? budget?.id ?? null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  formRef?.(form);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initial}
      onFinish={submit}
      disabled={nothingLeft}
    >
      {nothingLeft && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Toutes vos catégories ont déjà un budget ou une charge fixe."
          description="Créez une catégorie, ou modifiez un budget existant depuis la liste."
        />
      )}

      <Form.Item
        name="categoryId"
        label="Catégorie"
        rules={[{ required: true, message: "Choisissez une catégorie" }]}
      >
        <Select
          autoFocus={!editing}
          disabled={editing}
          showSearch
          placeholder="Choisir une catégorie"
          optionFilterProp="label"
          options={categories.map((c) => ({
            value: c.id,
            label: c.name,
            disabled: !!c.unavailable,
            reason: c.unavailable ?? null,
            color: c.color,
          }))}
          optionRender={(option) => (
            <Flex align="center" gap={8}>
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: option.data.color,
                  flex: "none",
                }}
              />
              <span style={{ flex: 1 }}>{option.data.label}</span>
              {option.data.reason && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {option.data.reason}
                </Text>
              )}
            </Flex>
          )}
        />
      </Form.Item>

      <Form.Item
        name="amount"
        label="Plafond"
        rules={[{ required: true, message: "Montant requis" }]}
      >
        <InputNumber
          autoFocus={editing}
          style={{ width: "100%" }}
          addonAfter="€"
          placeholder="300"
          min={0}
          step={10}
        />
      </Form.Item>

      <Form.Item name="period" label="Période">
        <Segmented
          options={[
            { value: "monthly", label: "Par mois" },
            { value: "weekly", label: "Par semaine" },
          ]}
        />
      </Form.Item>

      {/* A weekly ceiling is hard to compare with anything else on the page,
          so its monthly equivalent is stated as you type. */}
      {period === "weekly" && amount != null && amount > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Soit environ {formatCents(monthlyEquivalentCents(Math.round(amount * 100), "weekly"))} par
          mois.
        </Text>
      )}

      {footer && <div style={{ marginTop: 24 }}>{footer(saving)}</div>}
    </Form>
  );
}

/** The same form in a dialog, for editing from a budget's own page. */
export function BudgetForm({
  open,
  onOpenChange,
  ...props
}: Parameters<typeof BudgetFormBody>[0] & {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<FormInstance<Values> | null>(null);

  return (
    <Modal
      open={open}
      title={props.budget ? "Modifier le budget" : "Nouveau budget"}
      onCancel={() => onOpenChange(false)}
      onOk={() => form?.submit()}
      okText="Enregistrer"
      cancelText="Annuler"
      destroyOnHidden
    >
      <BudgetFormBody
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
