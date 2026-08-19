"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Flex } from "antd";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryFormBody } from "./category-form";

export function NewCategoryForm() {
  const router = useRouter();

  return (
    <Flex vertical gap={16} style={{ maxWidth: 520 }}>
      <PageHeader
        crumbs={[{ label: "Catégories", href: "/categories" }, { label: "Nouvelle catégorie" }]}
        description="Un nom et une couleur. Les règles et les marchands se rattachent ensuite depuis sa page."
      />
      <Card>
        <CategoryFormBody
          onDone={(id) => router.push(id ? `/categories/${id}` : "/categories")}
          footer={(saving) => (
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => router.push("/categories")}>Annuler</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Créer la catégorie
              </Button>
            </Flex>
          )}
        />
      </Card>
    </Flex>
  );
}
