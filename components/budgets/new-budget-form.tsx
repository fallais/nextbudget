"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Flex } from "antd";
import { PageHeader } from "@/components/layout/page-header";
import { BudgetFormBody, type BudgetFormCategory } from "./budget-form";

/**
 * Creating a budget is a page, and the category is chosen on it.
 *
 * The list of budgets used to double as the picker — every category without a
 * ceiling sat at the bottom as a button. That made the page a list of what you
 * have *and* a list of what you could have, and neither read cleanly.
 */
export function NewBudgetForm({ categories }: { categories: BudgetFormCategory[] }) {
  const router = useRouter();

  return (
    <Flex vertical gap={16} style={{ maxWidth: 560 }}>
      <PageHeader
        crumbs={[{ label: "Budgets", href: "/budgets" }, { label: "Nouveau budget" }]}
        description="La catégorie à plafonner, puis le montant. Celles qui ont déjà un budget, ou qu'une charge fixe couvre, ne sont pas proposées."
      />

      <Card>
        <BudgetFormBody
          categories={categories}
          onDone={(id) => router.push(id ? `/budgets/${id}` : "/budgets")}
          footer={(saving) => (
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => router.push("/budgets")}>Annuler</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Créer le budget
              </Button>
            </Flex>
          )}
        />
      </Card>
    </Flex>
  );
}
