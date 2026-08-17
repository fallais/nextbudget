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
  Wallet,
  Target,
  CalendarClock,
  Users2,
  Landmark,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserMenu, type CurrentUser } from "@/components/auth/user-menu";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const NAV: NavItem[] = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { label: "Comptes", href: "/comptes", icon: Wallet },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Budgets", href: "/budgets", icon: Target },
  { label: "Frais fixes", href: "/frais-fixes", icon: CalendarClock },
  { label: "Patrimoine", href: "/patrimoine", icon: Landmark },
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
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Wallet className="size-5 text-primary" />
            <span>BanqueJS</span>
          </Link>
        )}
        {collapsed && <Wallet className="size-5 text-primary" />}
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
      <div className="border-t p-2">
        <UserMenu user={user} authMode={authMode} collapsed={collapsed} />
      </div>
    </aside>
  );
}
