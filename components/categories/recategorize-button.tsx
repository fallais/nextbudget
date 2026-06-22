"use client";

import { useState, useTransition } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RecategorizeButton({
  onlyUncategorized = false,
  label = "Recatégoriser tout",
  variant = "secondary",
}: {
  onlyUncategorized?: boolean;
  label?: string;
  variant?: "default" | "secondary" | "outline";
}) {
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function run() {
    setLoading(true);
    try {
      const url = onlyUncategorized
        ? "/api/recategorize?only=uncategorized"
        : "/api/recategorize";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      const data = (await res.json()) as {
        scanned: number;
        updated: number;
        cleared: number;
      };
      toast.success("Recatégorisation terminée", {
        description: `${data.scanned} transactions examinées · ${data.updated} mises à jour · ${data.cleared} effacées`,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la recatégorisation", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} variant={variant}>
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Wand2 className="mr-2 size-4" />
      )}
      {label}
    </Button>
  );
}
