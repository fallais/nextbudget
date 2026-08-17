"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Users2, User, ArrowRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EnableAuthDialog } from "@/components/auth/enable-auth-dialog";
import { HouseholdWizard } from "./household-wizard";
import type { HouseholdMode } from "@/lib/db/settings";

export type SettingsMember = {
  id: number;
  name: string;
  /** The login this member is attached to, if any. */
  userId: number | null;
  email: string | null;
};

export function SettingsPane({
  household,
  authMode,
  members,
  accountCount,
  jointAccountCount,
  isOwner,
  me,
}: {
  household: HouseholdMode;
  authMode: "open" | "enforced";
  members: SettingsMember[];
  accountCount: number;
  jointAccountCount: number;
  isOwner: boolean;
  me: SettingsMember | null;
}) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function setHousehold(mode: HouseholdMode) {
    if (mode === household) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ household: mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      toast.success(mode === "couple" ? "Mode couple activé" : "Mode solo activé");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Foyer</h3>
          <p className="text-sm text-muted-foreground">
            Qui utilise cette application. Les personnes servent à répartir les
            apports et les quotes-parts du patrimoine.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            icon={<User className="size-4" />}
            title="Solo"
            description="Une seule personne. Les fonctionnalités de couple restent masquées."
            selected={household === "solo"}
            disabled={saving || !isOwner}
            onSelect={() => void setHousehold("solo")}
          />
          <ModeCard
            icon={<Users2 className="size-4" />}
            title="Couple"
            description="Deux personnes, chacune son compte, plus un compte commun."
            selected={household === "couple"}
            disabled={saving || !isOwner}
            onSelect={() => void setHousehold("couple")}
          />
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Membres ({members.length})
              </span>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                  Configurer le foyer
                </Button>
              )}
            </div>
            <ul className="space-y-1">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} editable={isOwner} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Confidentialité</h3>
          <p className="text-sm text-muted-foreground">
            Séparer les données de chacun suppose de savoir qui est devant
            l&apos;écran : la confidentialité implique donc une connexion.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Lock className="size-4" />
                {authMode === "enforced"
                  ? "Chacun son espace (connexion requise)"
                  : "Tout partagé (sans connexion)"}
              </p>
              <p className="text-sm text-muted-foreground">
                {authMode === "enforced"
                  ? "Chaque membre voit ses données et celles marquées comme partagées."
                  : "Tout le monde voit tout. Aucun mot de passe n'est demandé."}
              </p>
            </div>
            {authMode === "open" && isOwner && (
              <Button onClick={() => setAuthOpen(true)}>Activer la confidentialité</Button>
            )}
          </CardContent>
        </Card>
        {authMode === "enforced" && (
          <p className="text-xs text-muted-foreground">
            Mot de passe oublié ? Depuis le serveur :{" "}
            <code className="rounded bg-muted px-1 py-0.5">npm run auth:reset</code>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Comptes</h3>
          <p className="text-sm text-muted-foreground">
            {accountCount} compte{accountCount > 1 ? "s" : ""}
            {jointAccountCount > 0
              ? `, dont ${jointAccountCount} commun${jointAccountCount > 1 ? "s" : ""}.`
              : ", aucun compte commun."}
          </p>
        </div>
        <Link
          href="/comptes"
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          Gérer les comptes
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </section>

      <EnableAuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <HouseholdWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        members={members}
        hasJointAccount={jointAccountCount > 0}
        me={me}
      />
    </div>
  );
}

/**
 * A member's name and email, editable in place.
 *
 * The name is written to the person and, when one is attached, to the login
 * too. They are separate records on purpose — a person needs no login — but
 * they are one human, so letting the two names drift would only confuse.
 *
 * Email belongs to the login, so a member without one has nowhere to put it.
 * Rather than silently hiding the field, it is shown disabled with the reason.
 */
function MemberRow({ member, editable }: { member: SettingsMember; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  const [saving, setSaving] = useState(false);

  const hasLogin = member.userId != null;

  function reset() {
    setName(member.name);
    setEmail(member.email ?? "");
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    const nextEmail = email.trim();
    if (!nextName) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }
    const nameChanged = nextName !== member.name;
    const emailChanged = hasLogin && nextEmail !== (member.email ?? "");
    if (!nameChanged && !emailChanged) {
      reset();
      return;
    }

    setSaving(true);
    try {
      if (nameChanged) {
        const res = await fetch(`/api/persons/${member.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Échec du renommage");
        }
      }
      if (hasLogin && (nameChanged || emailChanged)) {
        const res = await fetch(`/api/users/${member.userId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(nameChanged ? { name: nextName } : {}),
            ...(emailChanged ? { email: nextEmail || null } : {}),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Échec de la mise à jour de la connexion");
        }
      }
      toast.success("Membre mis à jour");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error("Échec de l'enregistrement", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-md border bg-background p-3">
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`member-name-${member.id}`} className="text-xs">
                Nom
              </Label>
              <Input
                id={`member-name-${member.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`member-email-${member.id}`} className="text-xs">
                Email
              </Label>
              <Input
                id={`member-email-${member.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!hasLogin}
                placeholder={hasLogin ? "camille@exemple.com" : "—"}
                className="h-8"
              />
            </div>
          </div>
          {!hasLogin && (
            <p className="text-xs text-muted-foreground">
              L&apos;email sert à se connecter : rattachez d&apos;abord un compte
              utilisateur à cette personne depuis la page Apports.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Annuler
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <User className="size-3.5 text-muted-foreground" />
      <span>{member.name}</span>
      {member.email ? (
        <Badge variant="secondary">{member.email}</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">
          {hasLogin ? "connexion sans email" : "sans connexion"}
        </span>
      )}
      {editable && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil className="mr-1 size-3" />
          Modifier
        </Button>
      )}
    </li>
  );
}

function ModeCard({
  icon,
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-accent" : "hover:bg-accent/50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
    </button>
  );
}
