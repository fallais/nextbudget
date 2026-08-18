"use client";

import { Card, Col, Empty, Flex, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { STATUS } from "@shared/palette";
import { formatCents } from "@shared/format";
import type { ContributionStatus, PersonWithStatus } from "@application/contributions";

const { Title, Text } = Typography;

const STATE = {
  received: { label: "Reçu", color: STATUS.good },
  pending: { label: "En attente", color: STATUS.warning },
  anomaly: { label: "Montant inhabituel", color: STATUS.serious },
} as const;

/**
 * Who has paid what into the common pot this month.
 *
 * One card per person, each with its own table: the question is always "is
 * this person up to date", and a single flat table of every contribution would
 * make you reassemble that yourself.
 */
export function ApportsView({ perPerson }: { perPerson: PersonWithStatus[] }) {
  const active = perPerson.filter((p) => p.person.isActive);

  const columns: ColumnsType<ContributionStatus> = [
    { title: "Apport", render: (_, c) => c.contribution.name },
    {
      title: "État",
      width: 160,
      render: (_, c) => {
        const state = STATE[c.state];
        return (
          // The tag carries a word, so state never rests on colour alone.
          <Tag color={state.color} style={{ marginInlineEnd: 0 }}>
            {state.label}
          </Tag>
        );
      },
    },
    {
      title: "Attendu",
      align: "right",
      width: 120,
      render: (_, c) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCents(c.contribution.expectedAmountCents)}
        </Text>
      ),
    },
    {
      title: "Reçu",
      align: "right",
      width: 120,
      render: (_, c) => (
        <Text
          style={{ fontVariantNumeric: "tabular-nums" }}
          type={c.receivedCents > 0 ? undefined : "secondary"}
        >
          {c.receivedCents ? formatCents(c.receivedCents) : "—"}
        </Text>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Apports
        </Title>
        <Text type="secondary">
          Les versements mensuels sur le compte commun. Une personne peut en avoir
          plusieurs — un pour le loyer, un pour l&apos;énergie.
        </Text>
      </div>

      {active.length === 0 ? (
        <Card>
          <Empty
            description="Aucune personne active. Ajoutez des membres dans Paramètres → Foyer."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {active.map((p) => {
            const pct =
              p.expectedTotalCents > 0
                ? Math.min(100, Math.round((p.receivedTotalCents / p.expectedTotalCents) * 100))
                : 0;
            const complete = p.expectedTotalCents > 0 && p.receivedTotalCents >= p.expectedTotalCents;
            return (
              <Col key={p.person.id} xs={24} xl={12}>
                <Card
                  title={p.person.name}
                  extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {complete ? "à jour" : "en attente"}
                    </Text>
                  }
                >
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <Statistic
                        title="Reçu"
                        value={formatCents(p.receivedTotalCents)}
                        valueStyle={{ fontSize: 20, color: complete ? STATUS.good : undefined }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Attendu"
                        value={formatCents(p.expectedTotalCents)}
                        valueStyle={{ fontSize: 20 }}
                      />
                    </Col>
                  </Row>
                  <Progress
                    percent={pct}
                    showInfo={false}
                    size={["100%", 6]}
                    strokeColor={complete ? STATUS.good : STATUS.warning}
                  />
                  {p.contributions.length > 0 ? (
                    <Table
                      rowKey={(c) => c.contribution.id}
                      size="small"
                      columns={columns}
                      dataSource={p.contributions}
                      pagination={false}
                      style={{ marginTop: 12 }}
                    />
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Aucun apport déclaré pour cette personne.
                    </Text>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Flex>
  );
}
