"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Card,
  Flex,
  Select,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { InboxOutlined } from "@ant-design/icons";
import { STATUS } from "@shared/palette";
import type { AccountRow, ImportRow } from "@domain/entities";

const { Title, Text } = Typography;
const { Dragger } = Upload;

/**
 * Import: drop files, pick the account, watch the history.
 *
 * A dragger rather than a button-and-dialog — the whole page exists for one
 * action, so it should be the largest target on it.
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
  const [busy, setBusy] = useState(false);

  async function upload(files: File[]) {
    if (!accountId) {
      message.error("Choisissez d'abord un compte");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("accountId", String(accountId));
      for (const f of files) body.append("files", f);

      const res = await fetch("/api/ingest", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | { imported?: number; duplicates?: number; errors?: number; error?: string }
        | null;
      if (!res.ok) {
        message.error(data?.error ?? "Échec de l'import");
        return;
      }
      // Duplicates are normal, not a failure: re-importing an overlapping
      // statement is the usual way people catch up, and the dedup hash is what
      // makes that safe.
      message.success(
        `${data?.imported ?? 0} importée(s) · ${data?.duplicates ?? 0} doublon(s) ignoré(s)`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const columns: ColumnsType<ImportRow> = [
    {
      title: "Fichier",
      dataIndex: "filename",
      ellipsis: true,
    },
    {
      title: "Date",
      dataIndex: "startedAt",
      width: 160,
      render: (d: Date) => (
        <Text type="secondary">{new Date(d).toLocaleString("fr-FR")}</Text>
      ),
    },
    {
      title: "Résultat",
      width: 260,
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
    <Flex vertical gap={16} style={{ maxWidth: 980 }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Importer des relevés
        </Title>
        <Text type="secondary">
          Formats acceptés : .csv, .tsv, .txt. Les doublons sont détectés et ignorés.
        </Text>
      </div>

      {accounts.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="Aucun compte"
          description="Créez d'abord un compte dans Paramètres → Comptes."
        />
      ) : (
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
                const files = info.fileList
                  .map((f) => f.originFileObj as File | undefined)
                  .filter((f): f is File => !!f);
                if (files.length) void upload(files);
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
