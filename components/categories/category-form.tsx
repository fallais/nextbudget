"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, ColorPicker, Form, Input, Modal } from "antd";
import type { FormInstance } from "antd";
import type { CategoryRow } from "@domain/entities";

type Values = { name: string; color: string | { toHexString(): string }; icon: string };

/** The palette a new category is offered, so two never land the same colour by hand. */
const SUGGESTED = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

/**
 * Create or rename a category.
 *
 * Three fields, so this is a dialog on the detail page and a page only when
 * creating — the same split as Crédits: editing happens where the thing is,
 * creating happens somewhere you can be interrupted.
 */
export function CategoryFormBody({
  category,
  onDone,
  footer,
  formRef,
}: {
  category?: CategoryRow | null;
  onDone?: (id: number | null) => void;
  footer?: (submitting: boolean) => React.ReactNode;
  formRef?: (form: FormInstance<Values>) => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const editing = !!category;

  const initial: Values = {
    name: category?.name ?? "",
    color: category?.color ?? SUGGESTED[0],
    icon: category?.icon ?? "Tag",
  };

  async function submit(v: Values) {
    setSaving(true);
    try {
      const color = typeof v.color === "string" ? v.color : v.color.toHexString();
      const res = await fetch(editing ? `/api/categories/${category!.id}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: v.name, color, icon: v.icon || "Tag" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(data?.error ?? "Échec de l'enregistrement");
        return;
      }
      const created = editing
        ? null
        : ((await res.json().catch(() => null)) as { id?: number } | null);
      message.success(editing ? "Catégorie modifiée" : "Catégorie créée");
      onDone?.(created?.id ?? category?.id ?? null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  formRef?.(form);

  return (
    <Form form={form} layout="vertical" initialValues={initial} onFinish={submit}>
      <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
        <Input autoFocus placeholder="Alimentation" />
      </Form.Item>
      <Form.Item name="color" label="Couleur">
        <ColorPicker format="hex" disabledAlpha showText presets={[{ label: "Palette", colors: SUGGESTED }]} />
      </Form.Item>
      <Form.Item name="icon" hidden>
        <Input />
      </Form.Item>
      {footer && <div style={{ marginTop: 8 }}>{footer(saving)}</div>}
    </Form>
  );
}

export function CategoryForm({
  open,
  onOpenChange,
  ...props
}: Parameters<typeof CategoryFormBody>[0] & {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<FormInstance<Values> | null>(null);

  return (
    <Modal
      open={open}
      title={props.category ? "Modifier la catégorie" : "Nouvelle catégorie"}
      onCancel={() => onOpenChange(false)}
      onOk={() => form?.submit()}
      okText="Enregistrer"
      cancelText="Annuler"
      destroyOnHidden
    >
      <CategoryFormBody
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
