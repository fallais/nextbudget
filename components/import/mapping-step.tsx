"use client";

import { Alert, Card, Flex, InputNumber, Segmented, Select, Switch, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DATE_FORMATS, formatCents, formatDateShort } from "@shared/format";
import type { ColumnMapping } from "@infrastructure/ingest/parsers/csv-generic";
import type { FilePreview } from "@application/ingest";

const { Text } = Typography;

const DELIMITERS = [
  { value: ";", label: "point-virgule" },
  { value: ",", label: "virgule" },
  { value: "\t", label: "tabulation" },
  { value: "|", label: "barre verticale" },
];

const MISSING_LABELS: Record<string, string> = {
  date: "la date",
  description: "le libellé",
  amount: "le montant",
};

/**
 * What the parser made of one file, and the chance to correct it.
 *
 * Detection is shown as an answer that can be edited rather than as a result:
 * every select is pre-filled with what was recognised, and changing one
 * re-reads the file so the sample underneath always shows what would actually
 * be imported. That is what keeps the importer generic — an unfamiliar bank is
 * four selects, not a new parser.
 */
export function FileMappingCard({
  file,
  onChange,
  busy,
}: {
  file: FilePreview;
  /**
   * A mapping override for this file. Keys left out are re-detected, which is
   * how changing the delimiter re-reads the columns instead of keeping names
   * that no longer exist.
   */
  onChange: (override: Partial<ColumnMapping>) => void;
  busy: boolean;
}) {
  const preview = file.preview;

  if (!preview || file.error) {
    return (
      <Card size="small" title={file.filename}>
        <Alert type="error" showIcon message={file.error ?? "Fichier illisible"} />
      </Card>
    );
  }

  const m = preview.mapping;
  const pair = !m.amount && (!!m.debit || !!m.credit || preview.missing.includes("amount"));
  const headerOptions = preview.headers.map((h) => ({ value: h, label: h }));

  /** Column edits keep the rest of the mapping; layout edits let it re-detect. */
  const setColumn = (patch: Partial<ColumnMapping>) => onChange({ ...m, ...patch });
  const setLayout = (patch: Partial<ColumnMapping>) =>
    onChange({
      delimiter: m.delimiter,
      headerRowIndex: m.headerRowIndex,
      dateFormat: m.dateFormat,
      invertSign: m.invertSign,
      ...patch,
    });

  const columns: ColumnsType<(typeof preview.sample)[number]> = [
    {
      title: "Date",
      dataIndex: "date",
      width: 110,
      render: (d: string) => formatDateShort(d),
    },
    { title: "Libellé", dataIndex: "description", ellipsis: true },
    {
      title: "Montant",
      dataIndex: "amountCents",
      width: 130,
      align: "right",
      render: (c: number) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(c)}</Text>
      ),
    },
  ];

  const importable = preview.rowsTotal - preview.rowsError;

  return (
    <Card
      size="small"
      title={file.filename}
      extra={
        preview.missing.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {importable} ligne{importable > 1 ? "s" : ""} lisible
            {importable > 1 ? "s" : ""} sur {preview.rowsTotal}
          </Text>
        ) : null
      }
    >
      <Flex vertical gap={12}>
        {preview.missing.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`Colonne non reconnue : ${preview.missing.map((k) => MISSING_LABELS[k] ?? k).join(", ")}`}
            description="Choisissez-la ci-dessous — le reste du fichier est déjà lu."
          />
        )}

        <Flex gap={12} wrap align="flex-end">
          <Field label="Date">
            <Select
              style={{ width: 200 }}
              disabled={busy}
              value={m.date || undefined}
              placeholder="Colonne"
              options={headerOptions}
              onChange={(v) => setColumn({ date: v })}
              status={m.date ? undefined : "warning"}
            />
          </Field>

          <Field label="Libellé">
            <Select
              style={{ width: 200 }}
              disabled={busy}
              value={m.description || undefined}
              placeholder="Colonne"
              options={headerOptions}
              onChange={(v) => setColumn({ description: v })}
              status={m.description ? undefined : "warning"}
            />
          </Field>

          <Field label="Montant">
            <Segmented
              disabled={busy}
              value={pair ? "pair" : "single"}
              options={[
                { value: "single", label: "Une colonne" },
                { value: "pair", label: "Débit / crédit" },
              ]}
              onChange={(mode) =>
                // Dropping the other side lets detection fill it in.
                setColumn(
                  mode === "single"
                    ? { amount: undefined, debit: null, credit: null }
                    : { amount: null, debit: undefined, credit: undefined },
                )
              }
            />
          </Field>

          {pair ? (
            <>
              <Field label="Débit">
                <Select
                  style={{ width: 170 }}
                  allowClear
                  disabled={busy}
                  value={m.debit || undefined}
                  placeholder="Colonne"
                  options={headerOptions}
                  onChange={(v) => setColumn({ debit: v ?? null })}
                />
              </Field>
              <Field label="Crédit">
                <Select
                  style={{ width: 170 }}
                  allowClear
                  disabled={busy}
                  value={m.credit || undefined}
                  placeholder="Colonne"
                  options={headerOptions}
                  onChange={(v) => setColumn({ credit: v ?? null })}
                />
              </Field>
            </>
          ) : (
            <Field label="Colonne du montant">
              <Select
                style={{ width: 200 }}
                disabled={busy}
                value={m.amount || undefined}
                placeholder="Colonne"
                options={headerOptions}
                onChange={(v) => setColumn({ amount: v })}
                status={m.amount ? undefined : "warning"}
              />
            </Field>
          )}

          <Field label="Format de date">
            <Select
              style={{ width: 150 }}
              disabled={busy}
              value={m.dateFormat ?? "auto"}
              options={[
                { value: "auto", label: "Automatique" },
                ...DATE_FORMATS.map((f) => ({ value: f.value, label: f.label })),
              ]}
              onChange={(v) => setColumn({ dateFormat: v === "auto" ? null : v })}
            />
          </Field>

          <Field label="Séparateur">
            <Select
              style={{ width: 150 }}
              disabled={busy}
              value={m.delimiter}
              options={DELIMITERS}
              onChange={(v) => setLayout({ delimiter: v })}
            />
          </Field>

          <Field label="Ligne d'en-tête">
            <InputNumber
              style={{ width: 90 }}
              disabled={busy}
              min={1}
              max={100}
              value={m.headerRowIndex + 1}
              onChange={(v) => setLayout({ headerRowIndex: Math.max(0, (v ?? 1) - 1) })}
            />
          </Field>

          <Field label="Inverser le signe">
            <Switch
              disabled={busy}
              checked={m.invertSign}
              onChange={(v) => setColumn({ invertSign: v })}
            />
          </Field>
        </Flex>

        {preview.rowsError > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${preview.rowsError} ligne${preview.rowsError > 1 ? "s" : ""} illisible${preview.rowsError > 1 ? "s" : ""}, qui ${preview.rowsError > 1 ? "seront ignorées" : "sera ignorée"}`}
            description={
              <Flex vertical gap={2}>
                {preview.errors.slice(0, 3).map((e) => (
                  <Text key={e.row} type="secondary" style={{ fontSize: 12 }}>
                    ligne {e.row} — {e.message}
                  </Text>
                ))}
              </Flex>
            }
          />
        )}

        {preview.sample.length > 0 && (
          <Flex vertical gap={6}>
            <Flex align="center" gap={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Aperçu — les premières lignes telles qu&apos;elles seront importées
              </Text>
              {m.invertSign && <Tag bordered={false}>signe inversé</Tag>}
            </Flex>
            <Table
              rowKey={(r) => `${r.date}-${r.description}-${r.amountCents}`}
              size="small"
              columns={columns}
              dataSource={preview.sample}
              pagination={false}
            />
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex vertical gap={2}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      {children}
    </Flex>
  );
}
