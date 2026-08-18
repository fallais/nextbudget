"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Breadcrumb, Button, Card, Flex, Typography } from "antd";
import { AssetFormBody, type FormPerson } from "@/components/assets/asset-form";

const { Title, Text } = Typography;

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
    <Flex vertical gap={16} style={{ maxWidth: 720 }}>
      <Breadcrumb
        items={[{ title: <Link href="/credits">Crédits</Link> }, { title: "Nouveau" }]}
      />
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Nouveau crédit
        </Title>
        <Text type="secondary">
          Reprenez les chiffres de votre offre de prêt. L&apos;échéance et le TAEG sont
          recalculés au fur et à mesure pour vérifier la saisie.
        </Text>
      </div>

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
