"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Flex } from "antd";
import { PageHeader } from "@/components/layout/page-header";
import { AssetFormBody, type FormPerson } from "./asset-form";

/**
 * Creating an item is a page, matching Crédits.
 *
 * The same form body serves the modal used for editing from a list, where
 * losing your place would be the annoyance, and this page, where a loan's
 * twenty fields need room.
 */
export function NewAssetForm({
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
      <PageHeader
        crumbs={[{ label: "Patrimoine", href: "/patrimoine" }, { label: "Nouvel élément" }]}
        description="Un actif (épargne, immobilier, véhicule) ou un passif (crédit, prêt)."
      />

      <Card>
        <AssetFormBody
          accounts={accounts}
          persons={persons}
          mePersonId={mePersonId}
          linkableAssets={linkableAssets}
          onDone={() => router.push("/patrimoine")}
          footer={(saving) => (
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => router.push("/patrimoine")}>Annuler</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Enregistrer
              </Button>
            </Flex>
          )}
        />
      </Card>
    </Flex>
  );
}
