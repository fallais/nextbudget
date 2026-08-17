"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Landmark, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { AccountForm, ACCOUNT_KIND_LABELS } from "./account-form";
import type { Account } from "@/lib/db/entities";

export type AccountRow = Account & { txCount: number };

export function AccountsPane({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  function openForm(a: Account | null) {
    setEditing(a);
    setFormOpen(true);
  }

  async function remove(a: AccountRow) {
    if (!window.confirm(`Supprimer « ${a.name} » ?`)) return;
    const res = await fetch(`/api/accounts/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error("Suppression impossible", { description: data?.error });
      return;
    }
    toast.success("Compte supprimé");
    router.refresh();
  }

  const joint = accounts.filter((a) => a.kind === "joint");
  const personal = accounts.filter((a) => a.kind !== "joint");

  function renderSection(title: string, list: AccountRow[], empty: string) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">{empty}</p>
        ) : (
          <div className="space-y-2">
            {list.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  {a.kind === "joint" ? (
                    <Users2 className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Landmark className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.name}</span>
                      <Badge variant="secondary">{ACCOUNT_KIND_LABELS[a.kind]}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[a.bank, a.iban].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {a.txCount} transaction{a.txCount > 1 ? "s" : ""}
                  </span>
                  <VisibilityToggle kind="account" id={a.id} visibility={a.visibility} compact />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openForm(a)}
                    aria-label={`Modifier ${a.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => void remove(a)}
                    aria-label={`Supprimer ${a.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => openForm(null)}>
          <Plus className="mr-2 size-4" />
          Ajouter
        </Button>
      </div>

      {renderSection("Compte commun", joint, "Aucun compte commun.")}
      {renderSection("Comptes personnels", personal, "Aucun compte personnel.")}

      <AccountForm open={formOpen} onOpenChange={setFormOpen} account={editing} />
    </div>
  );
}
