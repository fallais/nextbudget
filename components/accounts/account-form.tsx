"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { AccountRow } from "@domain/entities";
import type { AccountKind } from "@domain/enums";

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  personal: "Personnel",
  joint: "Commun",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountRow | null;
};

export function AccountForm({ open, onOpenChange, account }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("personal");
  const [bank, setBank] = useState("");
  const [iban, setIban] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setKind(account?.kind ?? "personal");
    setBank(account?.bank ?? "");
    setIban(account?.iban ?? "");
  }, [open, account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        kind,
        bank: bank.trim() || null,
        iban: iban.trim() || null,
        // A common account is shared by definition; a personal one starts
        // shared too, and the inline toggle makes it private.
        ...(account ? {} : { visibility: "shared" as const }),
      };
      const res = await fetch(account ? `/api/accounts/${account.id}` : "/api/accounts", {
        method: account ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(account ? "Compte mis à jour" : "Compte créé");
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de l'enregistrement", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{account ? "Modifier le compte" : "Nouveau compte"}</DialogTitle>
            <DialogDescription>
              Un compte commun est celui sur lequel arrivent les apports du foyer.
              Les comptes personnels appartiennent à une seule personne.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nom</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  maxLength={80}
                  placeholder="Compte courant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-kind">Nature</Label>
                <Select
                  value={kind}
                  items={ACCOUNT_KIND_LABELS}
                  onValueChange={(v) => v && setKind(v as AccountKind)}
                >
                  <SelectTrigger id="account-kind" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personnel</SelectItem>
                    <SelectItem value="joint">Commun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="account-bank">Banque — optionnel</Label>
                <Input
                  id="account-bank"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  maxLength={80}
                  placeholder="Crédit Mutuel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-iban">IBAN — optionnel</Label>
                <Input
                  id="account-iban"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  maxLength={34}
                  placeholder="FR76…"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || name.trim().length === 0}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
