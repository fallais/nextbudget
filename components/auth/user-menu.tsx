"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, User as UserIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@shared/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EnableAuthDialog } from "./enable-auth-dialog";

export type CurrentUser = { id: number; name: string; role: "owner" | "member" } | null;

export function UserMenu({
  user,
  authMode,
  collapsed,
}: {
  user: CurrentUser;
  authMode: "open" | "enforced";
  collapsed?: boolean;
}) {
  const router = useRouter();
  const [enableOpen, setEnableOpen] = useState(false);
  if (!user) return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const roleLabel = user.role === "owner" ? "Propriétaire" : "Membre";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className={cn("h-auto w-full justify-start gap-2 px-2 py-2", collapsed && "justify-center")}
              title={collapsed ? user.name : undefined}
            />
          }
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
            <UserIcon className="size-3.5" />
          </span>
          {!collapsed && (
            <>
              <span className="flex min-w-0 flex-col items-start">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="text-xs text-sidebar-foreground/60">
                  {authMode === "open" ? "Mode ouvert" : roleLabel}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuLabel>
            {user.name} · {roleLabel}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {authMode === "open"
            ? user.role === "owner" && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setEnableOpen(true);
                  }}
                >
                  <ShieldCheck className="size-4" />
                  Activer l&apos;authentification
                </DropdownMenuItem>
              )
            : (
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut className="size-4" />
                  Se déconnecter
                </DropdownMenuItem>
              )}
        </DropdownMenuContent>
      </DropdownMenu>
      <EnableAuthDialog open={enableOpen} onOpenChange={setEnableOpen} />
    </>
  );
}
