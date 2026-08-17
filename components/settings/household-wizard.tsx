"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { SettingsMember } from "./settings-pane";

/**
 * One pass over the things a couple has to set up, so it is not a scavenger
 * hunt across three pages: name the second person, and create the common
 * account if there isn't one. Everything it writes stays editable afterwards
 * from Apports and Comptes.
 */
export function HouseholdWizard({
  open,
  onOpenChange,
  members,
  hasJointAccount,
  me,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: SettingsMember[];
  hasJointAccount: boolean;
  /** The member behind the current login, so you can name yourself here. */
  me: SettingsMember | null;
}) {
  const router = useRouter();
  const [myName, setMyName] = useState(me?.name ?? "");
  const [partnerName, setPartnerName] = useState("");
  const [createJoint, setCreateJoint] = useState(!hasJointAccount);
  const [jointName, setJointName] = useState("Compte commun");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMyName(me?.name ?? "");
    setPartnerName("");
    setCreateJoint(!hasJointAccount);
    setJointName("Compte commun");
  }, [open, hasJointAccount, me?.name]);

  const needsPartner = members.length < 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (me && myName.trim() && myName.trim() !== me.name) {
        await fetch(`/api/persons/${me.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: myName.trim() }),
        });
        if (me.userId != null) {
          await fetch(`/api/users/${me.userId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: myName.trim() }),
          });
        }
      }

      if (needsPartner && partnerName.trim()) {
        const res = await fetch("/api/persons", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: partnerName.trim(), tolerancePct: 5, isActive: true }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Échec de la création de la personne");
        }
      }

      if (createJoint) {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: jointName.trim() || "Compte commun",
            kind: "joint",
            visibility: "shared",
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Échec de la création du compte");
        }
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ household: "couple" }),
      });

      toast.success("Foyer configuré");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error("Échec de la configuration", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurer le foyer</DialogTitle>
          <DialogDescription>
            De quoi démarrer à deux. Tout reste modifiable ensuite.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {me && (
            <div className="space-y-2">
              <Label htmlFor="wizard-me">Votre nom</Label>
              <Input
                id="wizard-me"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Alex"
                maxLength={80}
                autoFocus
              />
            </div>
          )}

          {needsPartner ? (
            <div className="space-y-2">
              <Label htmlFor="wizard-partner">Nom de la deuxième personne</Label>
              <Input
                id="wizard-partner"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Camille"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                Vous pourrez lui rattacher une connexion depuis la page Apports.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Membres déjà enregistrés : {members.map((m) => m.name).join(", ")}.
            </p>
          )}

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={createJoint}
                onCheckedChange={(v) => setCreateJoint(v === true)}
                disabled={hasJointAccount}
              />
              Créer un compte commun
            </label>
            {hasJointAccount ? (
              <p className="text-xs text-muted-foreground">
                Vous en avez déjà un.
              </p>
            ) : (
              createJoint && (
                <Input
                  value={jointName}
                  onChange={(e) => setJointName(e.target.value)}
                  maxLength={80}
                  aria-label="Nom du compte commun"
                />
              )
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : "Terminer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
