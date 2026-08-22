"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Flex } from "antd";
import { PageHeader } from "@/components/layout/page-header";
import { AssetFormBody, type FormPerson } from "@/components/assets/asset-form";

export function NewCreditForm({
  accounts,
  persons,
  mePersonId,
  linkableAssets,
}: {
  accounts: { id: number; name: string }[];
  persons: FormPerson[];
  mePersonId: number | null;
  linkableAssets: { id: number; name: string }[];
}) {
  const router = useRouter();

  return (
    <Flex vertical gap={16}>
      <PageHeader
        crumbs={[{ label: "Crédits", href: "/credits" }, { label: "Nouveau crédit" }]}
        description="Reprenez les chiffres de votre offre de prêt. L'échéance et le TAEG sont recalculés au fur et à mesure pour vérifier la saisie."
      />

      <Card>
        <AssetFormBody
          accounts={accounts}
          persons={persons}
          mePersonId={mePersonId}
          linkableAssets={linkableAssets}
          defaultKind="liability"
          lockKind
          onDone={() => router.push("/credits")}
          footer={(saving) => (
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => router.push("/credits")}>Annuler</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Créer le crédit
              </Button>
            </Flex>
          )}
        />
      </Card>
    </Flex>
  );
}
