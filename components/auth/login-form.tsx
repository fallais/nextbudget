"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Flex, Form, Input, Typography } from "antd";
import { LogoMark } from "@/components/layout/logo";

const { Title, Text } = Typography;

/**
 * Sign-in.
 *
 * The failure message is deliberately the same for an unknown account, an
 * account with no password, and a wrong password — anything more specific
 * would let someone probe which names exist.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(values: { identifier: string; password: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        setError("Identifiants invalides");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: "100vh", padding: 20 }}>
      <Card style={{ width: 380 }}>
        <Flex vertical align="center" gap={4} style={{ marginBottom: 20 }}>
          <LogoMark style={{ width: 34, height: 34 }} />
          <Title level={4} style={{ margin: 0 }}>
            NextBudget
          </Title>
          <Text type="secondary">Connectez-vous pour continuer</Text>
        </Flex>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="identifier"
            label="Nom ou email"
            rules={[{ required: true, message: "Requis" }]}
          >
            <Input autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true, message: "Requis" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Se connecter
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
