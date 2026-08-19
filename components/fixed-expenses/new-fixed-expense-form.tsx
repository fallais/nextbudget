"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Flex } from "antd";
import { PageHeader } from "@/components/layout/page-header";
import { FixedExpenseFormBody } from "./fixed-expense-form";
import type { CategoryRow } from "@domain/entities";

export function NewFixedExpenseForm({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();

  return (
    <Flex vertical gap={16} style={{ maxWidth: 640 }}>
      <PageHeader
        crumbs={[{ label: "Frais fixes", href: "/frais-fixes" }, { label: "Nouvelle charge" }]}
        description="Le montant attendu et le texte qui identifie le paiement sur le relevé. Le rapprochement est fait à partir de vos transactions déjà importées."
      />
      <Card>
        <FixedExpenseFormBody
          categories={categories}
          onDone={(id) => router.push(id ? `/frais-fixes/${id}` : "/frais-fixes")}
          footer={(saving) => (
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => router.push("/frais-fixes")}>Annuler</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Créer la charge
              </Button>
            </Flex>
          )}
        />
      </Card>
    </Flex>
  );
}
