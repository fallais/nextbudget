"use client";

import Link from "next/link";
import { Card, Flex, Progress, Typography } from "antd";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { PersonWithStatus } from "@application/contributions";

const { Text } = Typography;

/**
 * Who has paid into the common pot this month.
 *
 * Absent entirely for a solo household, or where nobody has declared a
 * contribution — this is a couples feature and a one-person install should
 * never see a card about splitting.
 */
export function ApportsPanel({ perPerson }: { perPerson: PersonWithStatus[] }) {
  const active = perPerson.filter((p) => p.person.isActive && p.contributions.length > 0);
  if (active.length < 1) return null;

  return (
    <Card title="Apports du mois" extra={<Link href="/apports">Détail</Link>} style={{ height: "100%" }}>
      <Flex vertical gap={14}>
        {active.map((p) => {
          const expected = p.expectedTotalCents;
          const received = p.receivedTotalCents;
          const pct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;
          const complete = expected > 0 && received >= expected;
          return (
            <div key={p.person.id}>
              <Flex justify="space-between" align="baseline" gap={8}>
                <Text style={{ fontSize: 13 }}>{p.person.name}</Text>
                <Text
                  style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}
                  type={complete ? undefined : "secondary"}
                >
                  {formatCents(received)} / {formatCents(expected)}
                  {complete ? " · à jour" : " · en attente"}
                </Text>
              </Flex>
              <Progress
                percent={pct}
                showInfo={false}
                size={["100%", 6]}
                strokeColor={complete ? STATUS.good : STATUS.warning}
              />
            </div>
          );
        })}
      </Flex>
    </Card>
  );
}
