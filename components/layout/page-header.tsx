"use client";

import Link from "next/link";
import { Breadcrumb, Flex, Typography } from "antd";

const { Text } = Typography;

export type Crumb = { label: string; href?: string };

/**
 * The header every page wears.
 *
 * A breadcrumb rather than a large heading, even on a top-level page where the
 * trail is a single item. Detail pages need the trail anyway, and a page that
 * shouts its own title in 24px while its sibling whispers it in a breadcrumb
 * reads as two different applications. The name is in the sidebar, the tab
 * title and the trail — a third, larger copy earns nothing.
 */
export function PageHeader({
  crumbs,
  description,
  actions,
}: {
  crumbs: Crumb[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Flex justify="space-between" align="flex-start" wrap gap={12}>
      <Flex vertical gap={2}>
        <Breadcrumb
          items={crumbs.map((c) => ({
            title: c.href ? <Link href={c.href}>{c.label}</Link> : c.label,
          }))}
        />
        {description && (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {description}
          </Text>
        )}
      </Flex>
      {actions}
    </Flex>
  );
}
