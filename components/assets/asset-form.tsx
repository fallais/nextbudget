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
import { InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  deferralMonthsBetween,
  impliedTaegBps,
  monthlyPaymentCents,
  summarizeLoan,
} from "@domain/services/amortization";
import { Ownership, TOTAL_BPS, type OwnerShareRow } from "@domain/value-objects/share";
import { PROPERTY_CONDITION_LABELS, PROPERTY_CONDITIONS } from "@domain/enums";
import type { PropertyCondition } from "@domain/enums";
import { formatCents } from "@shared/format";
import type { FormInstance } from "antd";
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
  address: string | null;
  surfaceM2: number | null;
  landM2: number | null;
  propertyKind: "maison" | "appartement" | null;
  propertyCondition: PropertyCondition | null;
  accountId: number | null;
  notes: string | null;
  shareMode: "shared" | "mine" | "custom";
  shares: Record<number, number>;
  borrowerInsurance: Record<number, number | null>;
};

/**
 * Help that is only read when asked for.
 *
 * A field explaining itself in a line under the input pushes the next field
 * down and is read once, on the first visit; after that it is furniture. What
 * stays as `extra` is the figures that change as you type — those are
 * feedback, not help, and hiding the answer behind an icon would hide the
 * point of the field.
 */
const help = (title: string) => ({ title, icon: <InfoCircleOutlined /> });

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
export function AssetFormBody({
  asset,
  accounts,
  persons = [],
  owners = [],
  mePersonId = null,
  defaultKind = "asset",
  lockKind = false,
  linkableAssets = [],
  onDone,
  footer,
  formRef,
}: {
  asset?: AssetRow | null;
  accounts: { id: number; name: string }[];
  persons?: FormPerson[];
  owners?: AssetOwnerInput[];
  mePersonId?: number | null;
  defaultKind?: "asset" | "liability";
  lockKind?: boolean;
  linkableAssets?: { id: number; name: string }[];
  /** Called after a successful save. The modal closes; the page navigates. */
  onDone?: () => void;
  /** Rendered at the bottom of the form when it is a page rather than a modal. */
  footer?: (submitting: boolean) => React.ReactNode;
  formRef?: (form: FormInstance<Values>) => void;
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
    address: asset?.address ?? "",
    surfaceM2: asset?.surfaceM2 ?? null,
    landM2: asset?.landM2 ?? null,
    propertyKind: asset?.propertyKind ?? null,
    propertyCondition: asset?.propertyCondition ?? null,
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
  const isProperty = kind === "asset" && type === "real_estate";
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
        // Empty and underivable: a loan is worth what was borrowed until its
        // schedule can say otherwise. Zero would be a paid-off credit.
        valueCents: derivedBalance ?? cents(v.value) ?? (isLoan ? (cents(v.principal) ?? 0) : 0),
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
      if (isProperty) {
        body.address = v.address?.trim() || null;
        body.surfaceM2 = v.surfaceM2 ?? null;
        body.landM2 = v.landM2 ?? null;
        body.propertyKind = v.propertyKind ?? null;
        body.propertyCondition = v.propertyCondition ?? null;
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
      onDone?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  formRef?.(form);

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={submit}
        style={{ paddingTop: 8 }}
      >
        <Row gutter={12}>
          {lockKind ? (
            // Locked, but still a *registered* field. An unrendered Form.Item
            // contributes nothing to `onFinish`, so hiding this one behind
            // `!lockKind` sent the credit form's POST with no `kind` at all —
            // and creating a credit failed on a validation error about the
            // very value the form had decided for you.
            <Form.Item name="kind" hidden>
              <Input />
            </Form.Item>
          ) : (
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

        {/* A loan's balance is an outcome, not an opening question — it is
            asked for below, after the terms it is computed from. */}
        {!isLoan && (
          <Form.Item
            name="value"
            label={kind === "liability" ? "Solde restant dû (€)" : "Valeur (€)"}
            rules={[{ required: true, message: "Montant requis" }]}
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
                  tooltip={help(
                    "Le taux du prêt seul. Pas le TAEG, qui inclut déjà l'assurance et les frais et se saisit juste à côté.",
                  )}
                >
                  <InputNumber style={{ width: "100%" }} min={0} step={0.01} addonAfter="%" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="taeg"
                  label="TAEG"
                  tooltip={help(
                    "Le TAEG de votre offre. Il ne sert qu'à vérifier la saisie : celui que vos conditions impliquent est recalculé et comparé au vôtre.",
                  )}
                  extra={
                    taegGap === null
                      ? undefined
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
                  tooltip={help(
                    "Laissez vide pour la calculer depuis le capital, le taux et la durée. Renseignez-la pour imposer celle de votre offre.",
                  )}
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

            {derivedBalance !== null ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Solde restant dû : ${formatCents(derivedBalance)}`}
                description="Calculé depuis l'échéancier — il se met à jour tout seul à chaque échéance, sans rien à saisir ici."
              />
            ) : (
              <Form.Item
                name="value"
                label="Solde restant dû"
                tooltip={help(
                  "Presque toujours calculé : renseignez capital, taux, durée et 1re échéance et ce champ disparaît au profit du solde tiré de l'échéancier. Il ne reste à saisir que pour un prêt dont vous ne connaissez pas les conditions.",
                )}
                extra={
                  cents(principal) != null
                    ? `Laissé vide, le capital emprunté (${formatCents(cents(principal)!)}) est repris jusqu'à ce que l'échéancier prenne le relais.`
                    : "Laissez vide si vous renseignez les conditions du prêt ci-dessus."
                }
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  addonAfter="€"
                  placeholder="calculé"
                />
              </Form.Item>
            )}

            {linkableAssets.length > 0 && (
              <Form.Item
                name="linkedAssetId"
                label="Finance"
                tooltip={help(
                  "Le bien que ce prêt a financé — la maison pour un crédit immobilier. Le patrimoine les présente alors ensemble.",
                )}
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

        {isProperty && (
          <>
            <Divider titlePlacement="start" style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Le bien
              </Text>
            </Divider>

            <Form.Item
              name="address"
              label="Adresse"
              tooltip={help(
                "Sert à estimer le bien d'après les ventes enregistrées autour. Elle n'est envoyée nulle part tant que vous ne demandez pas une estimation.",
              )}
            >
              <Input placeholder="12 rue des Lilas, 31700 Blagnac" />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="propertyKind" label="Type de bien">
                  <Segmented
                    options={[
                      { value: "maison", label: "Maison" },
                      { value: "appartement", label: "Appartement" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="surfaceM2"
                  label="Surface habitable"
                  tooltip={help(
                    "La surface bâtie, comme elle figure à l'acte — c'est celle sur laquelle les ventes voisines sont comparées.",
                  )}
                >
                  <InputNumber style={{ width: "100%" }} min={1} max={100000} addonAfter="m²" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="landM2"
                  label="Surface du terrain"
                  tooltip={help(
                    "La parcelle, hors terres agricoles. Facultative : elle ne sert que là où la taille du terrain pèse réellement sur les prix de la commune, ce que l'estimation vérifie sur les ventes locales avant d'en tenir compte.",
                  )}
                >
                  <InputNumber style={{ width: "100%" }} min={1} max={10000000} addonAfter="m²" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="propertyCondition"
                  label="État général"
                  tooltip={help(
                    "Votre appréciation, pas une donnée publique : les ventes enregistrées ne disent rien de l'état des biens. Elle décale l'estimation d'un pourcentage d'usage.",
                  )}
                >
                  <Select
                    allowClear
                    placeholder="Non précisé"
                    options={PROPERTY_CONDITIONS.map((c) => ({
                      value: c,
                      label: PROPERTY_CONDITION_LABELS[c],
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
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

        {footer?.(saving)}
      </Form>
    </>
  );
}

/**
 * The same form in a dialog, for editing from a list without losing your place.
 * Creating goes to a page instead — a loan has twenty fields and a modal is the
 * wrong container for that much thinking.
 */
export function AssetForm({
  open,
  onOpenChange,
  ...props
}: Parameters<typeof AssetFormBody>[0] & {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<FormInstance<Values> | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={open}
      title={`${props.asset ? "Modifier" : "Ajouter"} ${props.lockKind ? "un crédit" : "un élément"}`}
      onCancel={() => onOpenChange(false)}
      onOk={() => form?.submit()}
      confirmLoading={saving}
      okText="Enregistrer"
      cancelText="Annuler"
      // A loan is twenty fields in two columns; 640px turned every row into a
      // pair of cramped boxes.
      width={960}
      style={{ top: 24, maxWidth: "calc(100vw - 32px)" }}
      destroyOnHidden
    >
      <AssetFormBody
        {...props}
        formRef={setForm}
        onDone={() => {
          setSaving(false);
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}
