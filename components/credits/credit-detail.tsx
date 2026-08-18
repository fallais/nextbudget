"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Breadcrumb, Button, Card, Flex, Popconfirm, Typography } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { AssetForm, type FormPerson } from "@/components/assets/asset-form";
import { AmortizationDetail } from "@/components/assets/amortization-detail";
import { CreditCard } from "./credit-card";
import type { AssetOwnerInput } from "@domain/repositories";
import type { CreditListItem } from "@application/credits";

const { Title } = Typography;

/** One credit in full: the summary card, then its schedule and cost. */
export function CreditDetail({
  item,
  owners,
  mePersonId,
  persons,
  accounts,
  linkableAssets,
}: {
  item: CreditListItem;
  owners: AssetOwnerInput[];
  mePersonId: number | null;
  persons: FormPerson[];
  accounts: { id: number; name: string }[];
  linkableAssets: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);

  async function remove() {
    const res = await fetch(`/api/assets/${item.credit.id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("Échec de la suppression");
      return;
    }
    message.success("Supprimé");
    router.push("/credits");
    router.refresh();
  }

  return (
    <Flex vertical gap={16}>
      <Breadcrumb
        items={[{ title: <Link href="/credits">Crédits</Link> }, { title: item.credit.name }]}
      />

      <Flex justify="space-between" align="center" wrap gap={12}>
        <Title level={3} style={{ margin: 0 }}>
          {item.credit.name}
        </Title>
        <Flex gap={8}>
          <Button icon={<EditOutlined />} onClick={() => setOpen(true)}>
            Modifier
          </Button>
          <Popconfirm
            title={`Supprimer « ${item.credit.name} » ?`}
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={remove}
          >
            <Button danger icon={<DeleteOutlined />}>
              Supprimer
            </Button>
          </Popconfirm>
        </Flex>
      </Flex>

      {/* The same card as the list, minus its own collapse — the schedule is
          expanded below instead, which is the point of coming here. */}
      <CreditCard item={item} />

      <Card title="Échéancier et coût">
        <AmortizationDetail asset={item.credit} defaultOpen />
      </Card>

      <AssetForm
        key={item.credit.id}
        open={open}
        onOpenChange={setOpen}
        asset={item.credit}
        accounts={accounts}
        persons={persons}
        owners={owners}
        mePersonId={mePersonId}
        defaultKind="liability"
        lockKind
        linkableAssets={linkableAssets}
      />
    </Flex>
  );
}
