"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  FolderTree,
  Upload,
  ChevronLeft,
  Target,
  CalendarClock,
  Users2,
  Landmark,
  Banknote,
  Settings,
} from "lucide-react";
import { cn } from "@shared/utils";
import { Button } from "@/components/ui/button";
import { UserMenu, type CurrentUser } from "@/components/auth/user-menu";
import { ThemeToggle } from "./theme-toggle";
import { LogoMark, LogoLockup } from "./logo";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

/**
 * Day-to-day money first, then what you own and owe, then the things you set up
 * once. Accounts are not here on purpose: creating and naming a bank account is
 * configuration, so it lives as a tab under Paramètres rather than as a
 * destination you visit while looking at your money.
 */
const NAV: NavItem[] = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Budgets", href: "/budgets", icon: Target },
  { label: "Frais fixes", href: "/frais-fixes", icon: CalendarClock },
  { label: "Patrimoine", href: "/patrimoine", icon: Landmark },
  { label: "Crédits", href: "/credits", icon: Banknote },
  { label: "Apports", href: "/apports", icon: Users2 },
  { label: "Catégories", href: "/categories", icon: FolderTree },
  { label: "Importer", href: "/import", icon: Upload },
  { label: "Paramètres", href: "/parametres", icon: Settings },
];

export function Sidebar({
  user,
  authMode,
}: {
  user: CurrentUser;
  authMode: "open" | "enforced";
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[240px]",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link href="/" aria-label="NextBudget">
            <LogoLockup />
          </Link>
        )}
        {collapsed && (
          <Link href="/" aria-label="NextBudget">
            <LogoMark className="size-6 text-brand" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
        >
          <ChevronLeft
            className={cn("size-4 transition-transform", collapsed && "rotate-180")}
          />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "flex items-center gap-1 border-t p-2",
          collapsed ? "flex-col" : "justify-between",
        )}
      >
        <div className="min-w-0 flex-1">
          <UserMenu user={user} authMode={authMode} collapsed={collapsed} />
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
