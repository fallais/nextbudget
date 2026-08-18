"use client";

import Link from "next/link";
import { Card, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Money } from "@/components/money";
import { formatDateShort } from "@shared/format";
import type { ListedTransaction } from "@application/queries";

const { Text } = Typography;

/**
 * The last few movements — the "what just happened" read, at the bottom
 * because it is the least urgent and the most detailed.
 *
 * A real table rather than a list: dates and amounts want columns to line up
 * down the page, which is the whole reason the figures are tabular-nums.
 */
export function RecentTransactions({ rows }: { rows: ListedTransaction[] }) {
  const columns: ColumnsType<ListedTransaction> = [
    {
      title: "Date",
      dataIndex: "date",
      width: 96,
      render: (d: string) => <Text type="secondary">{formatDateShort(d)}</Text>,
    },
    {
      title: "Libellé",
      dataIndex: "description",
      ellipsis: true,
    },
    {
      title: "Catégorie",
      dataIndex: "category",
      width: 160,
      render: (_, row) =>
        row.category ? (
          <Tag color={row.category.color} style={{ marginInlineEnd: 0 }}>
            {row.category.name}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Montant",
      dataIndex: "amountCents",
      align: "right",
      width: 130,
      // The column header says what these are, so no arrows here — the sign
      // alone carries direction in a labelled column.
      render: (cents: number) => <Money cents={cents} />,
    },
  ];

  return (
    <Card
      title="Dernières transactions"
      extra={<Link href="/transactions">Tout voir</Link>}
      styles={{ body: { padding: 0 } }}
    >
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: "Aucune transaction" }}
      />
    </Card>
  );
}
