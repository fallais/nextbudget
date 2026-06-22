"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type VisibilityKind =
  | "account"
  | "asset"
  | "budget"
  | "contribution"
  | "fixedExpense"
  | "rule";

/**
 * Inline private/shared toggle for an owned row. Only meaningful in enforced
 * (multi-user) mode; in open mode everything is shared.
 */
export function VisibilityToggle({
  kind,
  id,
  visibility,
  compact,
}: {
  kind: VisibilityKind;
  id: number;
  visibility: "private" | "shared";
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const shared = visibility === "shared";
  const next = shared ? "private" : "shared";

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/visibility", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id, visibility: next }),
      });
      if (!res.ok) {
        toast.error("Échec de la mise à jour");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void toggle()}
      disabled={loading}
      title={shared ? "Partagé — rendre privé" : "Privé — partager"}
      className="h-7 gap-1 px-2 text-xs text-muted-foreground"
    >
      {shared ? <Users className="size-3.5" /> : <Lock className="size-3.5" />}
      {!compact && (shared ? "Partagé" : "Privé")}
    </Button>
  );
}
