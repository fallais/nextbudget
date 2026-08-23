"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Card, Flex, Select, Table, Tag, Typography, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { InboxOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { STATUS } from "@shared/palette";
import { FileMappingCard } from "./mapping-step";
import type { ColumnMapping } from "@infrastructure/ingest/parsers/csv-generic";
import type { FilePreview } from "@application/ingest";
import type { AccountRow, ImportRow } from "@domain/entities";

const { Text } = Typography;
const { Dragger } = Upload;

type Mappings = Record<string, Partial<ColumnMapping>>;

/**
 * Import: drop files, check what was recognised, then write.
 *
 * The middle step is the point. Dropping a file used to import it on the spot,
 * which is fine while detection is right and quietly wrong when it is not —
 * a mis-read amount column becomes hundreds of rows to undo by hand. Now the
 * file is read, the mapping shown with its first lines, and nothing is written
 * until it is confirmed.
 */
export function ImportView({
  history,
  accounts,
}: {
  history: ImportRow[];
  accounts: Pick<AccountRow, "id" | "name" | "kind">[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FilePreview[] | null>(null);
  const [mappings, setMappings] = useState<Mappings>({});
  const [busy, setBusy] = useState(false);

  function reset() {
    setFiles([]);
    setPreviews(null);
    setMappings({});
  }

  async function loadPreview(next: File[], nextMappings: Mappings) {
    setBusy(true);
    try {
      const body = new FormData();
      for (const f of next) body.append("files", f);
      if (Object.keys(nextMappings).length > 0) {
        body.append("mappings", JSON.stringify(nextMappings));
      }
      const res = await fetch("/api/ingest/preview", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | { files?: FilePreview[]; error?: string }
        | null;
      if (!res.ok || !data?.files) {
        message.error(data?.error ?? "Échec de la lecture du fichier");
        return;
      }
      setFiles(next);
      setPreviews(data.files);
      setMappings(nextMappings);
    } finally {
      setBusy(false);
    }
  }

  /** A change to one file's mapping re-reads every file, keeping them in step. */
  function changeMapping(filename: string, override: Partial<ColumnMapping>) {
    void loadPreview(files, { ...mappings, [filename]: override });
  }

  async function confirmImport() {
    if (!accountId) {
      message.error("Choisissez d'abord un compte");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("accountId", String(accountId));
      for (const f of files) body.append("files", f);
      // The mapping shown is the mapping written — including the parts that
      // were detected rather than chosen, so a re-read cannot drift.
      const resolved: Mappings = Object.fromEntries(
        (previews ?? [])
          .filter((p) => p.preview)
          .map((p) => [p.filename, p.preview!.mapping]),
      );
      body.append("mappings", JSON.stringify(resolved));

      const res = await fetch("/api/ingest", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | {
            totals?: { new: number; duplicate: number; error: number };
            transfersDetected?: number;
            error?: string;
          }
        | null;
      if (!res.ok) {
        message.error(data?.error ?? "Échec de l'import");
        return;
      }
      // Duplicates are normal, not a failure: re-importing an overlapping
      // statement is the usual way people catch up, and the dedup hash is what
      // makes that safe.
      const transfers = data?.transfersDetected ?? 0;
      message.success(
        `${data?.totals?.new ?? 0} importée(s) · ${data?.totals?.duplicate ?? 0} doublon(s) ignoré(s)` +
          (transfers > 0 ? ` · ${transfers} virement(s) interne(s) reconnu(s)` : ""),
      );
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const ready =
    previews !== null &&
    previews.length > 0 &&
    previews.every((p) => p.preview && p.preview.missing.length === 0);
  const importableRows = (previews ?? []).reduce(
    (sum, p) => sum + (p.preview ? p.preview.rowsTotal - p.preview.rowsError : 0),
    0,
  );

  const columns: ColumnsType<ImportRow> = [
    { title: "Fichier", dataIndex: "filename", ellipsis: true },
    {
      title: "Date",
      dataIndex: "startedAt",
      width: 180,
      render: (d: Date) => <Text type="secondary">{new Date(d).toLocaleString("fr-FR")}</Text>,
    },
    {
      title: "Résultat",
      width: 280,
      render: (_, r) => (
        <Flex gap={6} wrap>
          <Tag color={STATUS.good}>{r.rowsNew} nouvelles</Tag>
          {r.rowsDuplicate > 0 && <Tag>{r.rowsDuplicate} doublons</Tag>}
          {r.rowsError > 0 && <Tag color={STATUS.critical}>{r.rowsError} erreurs</Tag>}
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Importer" }]}
        description="Formats acceptés : .csv, .tsv, .txt. Les colonnes reconnues sont montrées avant l'import, et les doublons sont ignorés."
      />

      {accounts.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="Aucun compte"
          description="Créez d'abord un compte dans Paramètres → Comptes."
        />
      ) : previews === null ? (
        <Card size="small">
          <Flex vertical gap={12}>
            <Flex align="center" gap={10} wrap>
              <Text>Importer dans</Text>
              <Select
                style={{ minWidth: 240 }}
                value={accountId}
                onChange={setAccountId}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.kind === "joint" ? `${a.name} (commun)` : a.name,
                }))}
              />
            </Flex>

            <Dragger
              multiple
              accept=".csv,.tsv,.txt"
              disabled={busy}
              showUploadList={false}
              beforeUpload={() => false}
              onChange={(info) => {
                const chosen = info.fileList
                  .map((f) => f.originFileObj as File | undefined)
                  .filter((f): f is File => !!f);
                if (chosen.length) void loadPreview(chosen, {});
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Déposez vos relevés ici, ou cliquez pour les choisir
              </p>
              <p className="ant-upload-hint">Plusieurs fichiers à la fois, c&apos;est prévu.</p>
            </Dragger>
          </Flex>
        </Card>
      ) : (
        <Flex vertical gap={16}>
          {previews.map((p) => (
            <FileMappingCard
              key={p.filename}
              file={p}
              busy={busy}
              onChange={(override) => changeMapping(p.filename, override)}
            />
          ))}

          <Flex justify="space-between" align="center" gap={12} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {ready
                ? `${importableRows} transaction${importableRows > 1 ? "s" : ""} prête${importableRows > 1 ? "s" : ""} à importer dans « ${accounts.find((a) => a.id === accountId)?.name ?? "—"} ».`
                : "Complétez les colonnes manquantes pour continuer."}
            </Text>
            <Flex gap={8}>
              <Button onClick={reset} disabled={busy}>
                Annuler
              </Button>
              <Button
                type="primary"
                loading={busy}
                disabled={!ready || importableRows === 0}
                onClick={confirmImport}
              >
                Importer
              </Button>
            </Flex>
          </Flex>
        </Flex>
      )}

      <Card title="Historique des imports" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={history}
          pagination={false}
          locale={{ emptyText: "Aucun import pour l'instant" }}
        />
      </Card>
    </Flex>
  );
}
