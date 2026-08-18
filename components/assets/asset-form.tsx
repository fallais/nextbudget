"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Typography,
} from "antd";
import dayjs from "dayjs";
import {
  deferralMonthsBetween,
  impliedTaegBps,
  monthlyPaymentCents,
  summarizeLoan,
} from "@domain/services/amortization";
import { Ownership, TOTAL_BPS, type OwnerShareRow } from "@domain/value-objects/share";
import { formatCents } from "@shared/format";
import type { AssetRow } from "@domain/entities";
import type { AssetOwnerInput } from "@domain/repositories";

const { Text } = Typography;

export type FormPerson = { id: number; name: string };

export const ASSET_TYPE_LABELS: Record<string, string> = {
  real_estate: "Immobilier",
  vehicle: "Véhicule",
  savings: "Épargne",
  investment: "Investissement",
  loan: "Prêt",
  mortgage: "Crédit immobilier",
  other: "Autre",
};

// A liability cannot be "Immobilier", and an asset cannot be a mortgage.
const ASSET_TYPES = ["real_estate", "vehicle", "savings", "investment", "other"];
const LIABILITY_TYPES = ["mortgage", "loan", "other"];
const typesFor = (k: string) => (k === "asset" ? ASSET_TYPES : LIABILITY_TYPES);
const defaultTypeFor = (k: string) => (k === "asset" ? "savings" : "mortgage");

/** Local date, not UTC: an instalment falls on a calendar day, not an instant. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Values = {
  name: string;
  kind: "asset" | "liability";
  type: string;
  value: number | null;
  principal: number | null;
  rate: number | null;
  taeg: number | null;
  term: number | null;
  monthly: number | null;
  insurance: number | null;
  fees: number | null;
  signatureDate: dayjs.Dayjs | null;
  startDate: dayjs.Dayjs | null;
  linkedAssetId: number | null;
  accountId: number | null;
  notes: string | null;
  shareMode: "shared" | "mine" | "custom";
  shares: Record<number, number>;
  borrowerInsurance: Record<number, number | null>;
};

/**
 * Create or edit an asset or a liability.
 *
 * Two things here are not cosmetic. The outstanding balance of a dated loan is
 * derived from its schedule rather than typed — a hand-entered figure is wrong
 * from the month after it is entered and drags net worth with it. And the rate
 * is asked for twice on purpose: the taux nominal drives the amortization,
 * while the TAEG is only cross-checked against what the terms imply, because
 * the TAEG is the number borrowers remember and putting it in the nominal
 * field silently inflates every instalment.
 */
export function AssetForm({
  open,
  onOpenChange,
  asset,
  accounts,
  persons = [],
  owners = [],
  mePersonId = null,
  defaultKind = "asset",
  lockKind = false,
  linkableAssets = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: AssetRow | null;
  accounts: { id: number; name: string }[];
  persons?: FormPerson[];
  owners?: AssetOwnerInput[];
  mePersonId?: number | null;
  defaultKind?: "asset" | "liability";
  lockKind?: boolean;
  linkableAssets?: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const editing = !!asset;

  const initial: Partial<Values> = {
    name: asset?.name ?? "",
    kind: asset?.kind ?? defaultKind,
    type: asset?.type ?? defaultTypeFor(defaultKind),
    value: asset ? asset.valueCents / 100 : null,
    principal: asset?.principalCents != null ? asset.principalCents / 100 : null,
    rate: asset?.interestRateBps != null ? asset.interestRateBps / 100 : null,
    taeg: asset?.taegBps != null ? asset.taegBps / 100 : null,
    term: asset?.termMonths ?? null,
    monthly: asset?.monthlyPaymentCents != null ? asset.monthlyPaymentCents / 100 : null,
    insurance: asset?.insuranceMonthlyCents != null ? asset.insuranceMonthlyCents / 100 : null,
    fees: asset?.feesCents != null ? asset.feesCents / 100 : null,
    signatureDate: asset?.signatureDate ? dayjs(asset.signatureDate) : null,
    startDate: asset?.startDate ? dayjs(asset.startDate) : null,
    linkedAssetId: asset?.linkedAssetId ?? null,
    accountId: asset?.accountId ?? null,
    notes: asset?.notes ?? "",
    shareMode: owners.length === 0 ? "mine" : owners.length > 1 ? "shared" : "custom",
    shares: Object.fromEntries(persons.map((p) => [p.id, (owners.find((o) => o.personId === p.id)?.shareBps ?? 0) / 100])),
    borrowerInsurance: Object.fromEntries(
      persons.map((p) => {
        const c = owners.find((o) => o.personId === p.id)?.insuranceMonthlyCents;
        return [p.id, c != null ? c / 100 : null];
      }),
    ),
  };

  // Watched so the derived figures below update as you type.
  const kind = Form.useWatch("kind", form) ?? initial.kind;
  const type = Form.useWatch("type", form) ?? initial.type;
  const principal = Form.useWatch("principal", form);
  const rate = Form.useWatch("rate", form);
  const taeg = Form.useWatch("taeg", form);
  const term = Form.useWatch("term", form);
  const monthly = Form.useWatch("monthly", form);
  const insurance = Form.useWatch("insurance", form);
  const fees = Form.useWatch("fees", form);
  const signatureDate = Form.useWatch("signatureDate", form);
  const startDate = Form.useWatch("startDate", form);
  const shareMode = Form.useWatch("shareMode", form) ?? initial.shareMode;
  const borrowerInsurance = Form.useWatch("borrowerInsurance", form);

  const isLoan = kind === "liability" && (type === "loan" || type === "mortgage");
  const showShares = persons.length > 1;
  const splitInsurance = isLoan && showShares;

  const cents = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));
  const bps = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));

  const perBorrowerTotal = persons.reduce(
    (sum, p) => sum + (cents(borrowerInsurance?.[p.id]) ?? 0),
    0,
  );
  const insuranceCents = splitInsurance ? perBorrowerTotal : (cents(insurance) ?? 0);

  const loanInput =
    isLoan && cents(principal) != null && bps(rate) != null && term
      ? {
          principalCents: cents(principal)!,
          interestRateBps: bps(rate)!,
          termMonths: term,
          monthlyPaymentCents: cents(monthly),
          insuranceMonthlyCents: insuranceCents,
          feesCents: cents(fees),
          startDate: startDate ? startDate.format("YYYY-MM-DD") : null,
        }
      : null;

  const computedPayment = loanInput
    ? monthlyPaymentCents(loanInput.principalCents, loanInput.interestRateBps, loanInput.termMonths)
    : null;

  // Once the schedule can be dated, the balance stops being an input.
  const derivedBalance =
    loanInput?.startDate
      ? (summarizeLoan(loanInput, todayIso())?.progress?.principalRemainingCents ??
        loanInput.principalCents)
      : null;

  const impliedTaeg = loanInput ? impliedTaegBps(loanInput) : null;
  const statedTaeg = bps(taeg);
  const taegGap =
    impliedTaeg != null && statedTaeg != null ? Math.abs(impliedTaeg - statedTaeg) : null;

  const deferral = deferralMonthsBetween(
    signatureDate ? signatureDate.format("YYYY-MM-DD") : null,
    startDate ? startDate.format("YYYY-MM-DD") : null,
  );

  function ownersPayload(v: Values): AssetOwnerInput[] | undefined {
    if (!showShares) return undefined;
    const base: OwnerShareRow[] | undefined =
      v.shareMode === "shared"
        ? Ownership.even(persons.map((p) => p.id)).toRows()
        : v.shareMode === "mine"
          ? mePersonId != null
            ? [{ personId: mePersonId, shareBps: TOTAL_BPS }]
            : undefined
          : persons
              .map((p) => ({ personId: p.id, shareBps: Math.round((v.shares?.[p.id] ?? 0) * 100) }))
              .filter((o) => o.shareBps > 0);
    if (!base) return undefined;
    return base.map((o) => ({
      ...o,
      insuranceMonthlyCents: splitInsurance ? cents(v.borrowerInsurance?.[o.personId]) : null,
    }));
  }

  async function submit(v: Values) {
    setSaving(true);
    try {
      const ownersOut = ownersPayload(v);
      if (ownersOut) {
        try {
          Ownership.fromRows(ownersOut);
        } catch {
          message.error("Les quotes-parts doivent totaliser 100 %.");
          return;
        }
      }

      const body: Record<string, unknown> = {
        name: v.name,
        kind: v.kind,
        type: v.type,
        valueCents: derivedBalance ?? cents(v.value) ?? 0,
        accountId: v.accountId ?? null,
        notes: v.notes || null,
        ...(ownersOut ? { owners: ownersOut } : {}),
      };
      if (isLoan) {
        body.principalCents = cents(v.principal);
        body.interestRateBps = bps(v.rate);
        body.taegBps = bps(v.taeg);
        body.termMonths = v.term ?? null;
        body.monthlyPaymentCents = cents(v.monthly);
        // A split loan carries premiums per borrower instead; keeping a
        // loan-level figure as well would double the insurance in the totals.
        body.insuranceMonthlyCents = splitInsurance ? null : cents(v.insurance);
        body.feesCents = cents(v.fees);
        body.signatureDate = v.signatureDate ? v.signatureDate.format("YYYY-MM-DD") : null;
        body.startDate = v.startDate ? v.startDate.format("YYYY-MM-DD") : null;
        body.linkedAssetId = v.linkedAssetId ?? null;
      }

      const res = await fetch(editing ? `/api/assets/${asset!.id}` : "/api/assets", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        message.error(data?.error ?? "Échec de l'enregistrement");
        return;
      }
      message.success(editing ? "Modifié" : "Ajouté");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={`${editing ? "Modifier" : "Ajouter"} ${lockKind ? "un crédit" : "un élément"}`}
      onCancel={() => onOpenChange(false)}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Enregistrer"
      cancelText="Annuler"
      width={640}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={submit}
        style={{ paddingTop: 8 }}
      >
        <Row gutter={12}>
          {!lockKind && (
            <Col span={8}>
              <Form.Item name="kind" label="Nature">
                <Segmented
                  options={[
                    { value: "asset", label: "Actif" },
                    { value: "liability", label: "Passif" },
                  ]}
                  onChange={(k) => {
                    const next = String(k);
                    if (!typesFor(next).includes(form.getFieldValue("type"))) {
                      form.setFieldValue("type", defaultTypeFor(next));
                    }
                  }}
                />
              </Form.Item>
            </Col>
          )}
          <Col span={lockKind ? 10 : 8}>
            <Form.Item name="type" label="Type">
              <Select
                options={typesFor(kind ?? "asset").map((t) => ({
                  value: t,
                  label: ASSET_TYPE_LABELS[t],
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={lockKind ? 14 : 8}>
            <Form.Item name="name" label="Nom" rules={[{ required: true, message: "Nom requis" }]}>
              <Input placeholder={kind === "liability" ? "Crédit maison" : "Maison"} />
            </Form.Item>
          </Col>
        </Row>

        {derivedBalance !== null ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Solde restant dû : ${formatCents(derivedBalance)}`}
            description="Calculé depuis l'échéancier — il se met à jour tout seul à chaque échéance."
          />
        ) : (
          <Form.Item
            name="value"
            label={kind === "liability" ? "Solde restant dû (€)" : "Valeur (€)"}
            rules={[{ required: true, message: "Montant requis" }]}
            extra={
              isLoan
                ? "Renseignez capital, taux, durée et 1re échéance pour qu'il soit calculé."
                : undefined
            }
          >
            <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
          </Form.Item>
        )}

        {isLoan && (
          <>
            <Divider titlePlacement="start" style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Conditions du prêt
              </Text>
            </Divider>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="principal" label="Capital emprunté">
                  <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="term" label="Durée">
                  <InputNumber style={{ width: "100%" }} min={1} max={1200} addonAfter="mois" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="rate"
                  label="Taux nominal"
                  extra="Pas le TAEG — celui-ci inclut déjà assurance et frais."
                >
                  <InputNumber style={{ width: "100%" }} min={0} step={0.01} addonAfter="%" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="taeg"
                  label="TAEG"
                  extra={
                    taegGap === null
                      ? "Sert uniquement de vérification."
                      : taegGap <= 25
                        ? `Cohérent avec vos conditions (${((impliedTaeg ?? 0) / 100).toFixed(2)} % calculé).`
                        : `Vos conditions impliquent ${((impliedTaeg ?? 0) / 100).toFixed(2)} % — vérifiez taux, assurance ou frais.`
                  }
                >
                  <InputNumber style={{ width: "100%" }} min={0} step={0.01} addonAfter="%" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="monthly"
                  label="Mensualité"
                  extra={
                    computedPayment !== null
                      ? `Calculée : ${formatCents(computedPayment)}`
                      : undefined
                  }
                >
                  <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" placeholder="auto" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="fees" label="Frais (dossier, garantie…)">
                  <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
                </Form.Item>
              </Col>
            </Row>

            {!splitInsurance && (
              <Form.Item name="insurance" label="Assurance (€/mois)">
                <InputNumber style={{ width: "100%" }} min={0} addonAfter="€" />
              </Form.Item>
            )}

            {/* Assurance emprunteur is priced per borrower — different ages,
                different quotités — so a shared loan carries two premiums. */}
            {splitInsurance && (
              <Form.Item label="Assurance emprunteur (€/mois, par personne)">
                <Row gutter={12}>
                  {persons.map((p) => (
                    <Col span={12} key={p.id}>
                      <Form.Item name={["borrowerInsurance", String(p.id)]} label={p.name} noStyle>
                        <InputNumber style={{ width: "100%" }} min={0} addonBefore={p.name} addonAfter="€" />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Total {formatCents(perBorrowerTotal)} par mois.
                </Text>
              </Form.Item>
            )}

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="signatureDate" label="Date de signature">
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="startDate" label="1re échéance">
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>

            {deferral !== null && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Crédit différé : ${deferral} mois entre la signature et la première échéance.`}
                description="L'échéancier démarre à la première échéance ; les intérêts intercalaires ne sont pas encore comptés dans le coût."
              />
            )}

            {linkableAssets.length > 0 && (
              <Form.Item
                name="linkedAssetId"
                label="Finance"
                extra="Le bien que ce prêt a financé — la maison pour un crédit immobilier."
              >
                <Select
                  allowClear
                  placeholder="Aucun bien"
                  options={linkableAssets.map((a) => ({ value: a.id, label: a.name }))}
                />
              </Form.Item>
            )}
          </>
        )}

        {showShares && (
          <>
            <Divider titlePlacement="start">
              <Text type="secondary" style={{ fontSize: 12 }}>
                Quotes-parts
              </Text>
            </Divider>
            <Form.Item name="shareMode">
              <Segmented
                options={[
                  { value: "shared", label: "À parts égales" },
                  { value: "mine", label: "À moi" },
                  { value: "custom", label: "Personnalisé" },
                ]}
              />
            </Form.Item>
            {shareMode === "custom" && (
              <Row gutter={12}>
                {persons.map((p) => (
                  <Col span={12} key={p.id}>
                    <Form.Item name={["shares", String(p.id)]} label={p.name}>
                      <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            )}
          </>
        )}

        {accounts.length > 0 && !isLoan && (
          <Form.Item name="accountId" label="Compte associé">
            <Select
              allowClear
              placeholder="Aucun"
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
        )}

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
