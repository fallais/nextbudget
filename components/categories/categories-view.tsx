"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Card, Empty, Flex, Typography } from "antd";
import { PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/layout/page-header";
import { formatCents } from "@shared/format";
import { CategoryItemRow } from "./category-row";
import type { CategoryRow } from "@domain/entities";

const { Text } = Typography;

export type CategoryListItem = {
  category: CategoryRow;
  ruleCount: number;
  merchantCount: number;
  spentCents: number;
};

/**
 * Catégories: what your money is sorted into, and what does the sorting.
 *
 * Was a two-pane console — categories on the left, their rules on the right —
 * which meant the page could only ever show one category's rules and never the
 * shape of the whole set. It is now a list of rows leading to a page each,
 * like Crédits, Patrimoine and Budgets, with the sorted-most-spent order
 * putting the categories that matter at the top.
 */
export function CategoriesView({
  items,
  merchantTotal,
}: {
  items: CategoryListItem[];
  merchantTotal: number;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [recategorizing, setRecategorizing] = useState(false);

  async function recategorize() {
    setRecategorizing(true);
    try {
      const res = await fetch("/api/recategorize", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { updated?: number } | null;
      if (!res.ok) {
        message.error("Échec du reclassement");
        return;
      }
      message.success(`${data?.updated ?? 0} transaction(s) reclassée(s)`);
      router.refresh();
    } finally {
      setRecategorizing(false);
    }
  }

  const ruleTotal = items.reduce((sum, i) => sum + i.ruleCount, 0);
  const spentTotal = items.reduce((sum, i) => sum + i.spentCents, 0);

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Catégories" }]}
        description="Ce dans quoi vos dépenses tombent, et ce qui les y met : vos règles, et les marchands reconnus d'office."
        actions={
          <Flex gap={8}>
            <Button icon={<ThunderboltOutlined />} loading={recategorizing} onClick={recategorize}>
              Reclasser tout
            </Button>
            <Link href="/categories/nouvelle">
              <Button type="primary" icon={<PlusOutlined />}>
                Ajouter une catégorie
              </Button>
            </Link>
          </Flex>
        }
      />

      {items.length > 0 && (
        <Card>
          <Flex gap={40} wrap>
            <Figure label="Dépensé ce mois" value={formatCents(spentTotal)} />
            <Figure label="Catégories" value={String(items.length)} />
            <Figure label="Vos règles" value={String(ruleTotal)} />
            <Figure label="Marchands reconnus" value={String(merchantTotal)} />
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Les marchands reconnus sont livrés avec l&apos;application et se mettent à jour avec
            elle. Vos règles passent toujours devant.
          </Text>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <Empty description="Aucune catégorie" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Link href="/categories/nouvelle">
              <Button type="primary" icon={<PlusOutlined />}>
                Ajouter une catégorie
              </Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <Flex vertical gap={8}>
          {items.map((item) => (
            <CategoryItemRow
              key={item.category.id}
              category={item.category}
              ruleCount={item.ruleCount}
              merchantCount={item.merchantCount}
              spentCents={item.spentCents}
            />
          ))}
        </Flex>
      )}
    </Flex>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Flex vertical gap={1}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
    </Flex>
  );
}
