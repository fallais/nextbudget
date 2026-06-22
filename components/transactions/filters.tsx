"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CategoryBadge } from "@/components/categories/category-badge";
import type { Category, Account } from "@/lib/db/schema";

type Props = {
  categories: Category[];
  accounts: Account[];
};

function toIsoDate(d: Date | undefined) {
  return d ? format(d, "yyyy-MM-dd") : undefined;
}

function fromIsoDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function TransactionsFilters({ categories, accounts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initial = {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    search: searchParams.get("search") ?? "",
    amountMin: searchParams.get("amountMin") ?? "",
    amountMax: searchParams.get("amountMax") ?? "",
    categoryIds: (searchParams.get("categoryIds") ?? "")
      .split(",")
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10)),
    accountIds: (searchParams.get("accountIds") ?? "")
      .split(",")
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10)),
    uncategorized: searchParams.get("uncategorized") === "1",
  };

  const [from, setFrom] = useState<Date | undefined>(fromIsoDate(initial.from));
  const [to, setTo] = useState<Date | undefined>(fromIsoDate(initial.to));
  const [search, setSearch] = useState(initial.search);
  const [amountMin, setAmountMin] = useState(initial.amountMin);
  const [amountMax, setAmountMax] = useState(initial.amountMax);
  const [categoryIds, setCategoryIds] = useState<number[]>(initial.categoryIds);
  const [accountIds, setAccountIds] = useState<number[]>(initial.accountIds);
  const [uncategorized, setUncategorized] = useState(initial.uncategorized);

  function applyFilters() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("page");
    const setOrDelete = (key: string, value: string | undefined) => {
      if (value && value.length > 0) next.set(key, value);
      else next.delete(key);
    };
    setOrDelete("from", toIsoDate(from));
    setOrDelete("to", toIsoDate(to));
    setOrDelete("search", search.trim());
    if (amountMin.trim()) {
      const cents = Math.round(Number(amountMin.replace(",", ".")) * 100);
      if (Number.isFinite(cents)) next.set("amountMin", String(cents));
    } else next.delete("amountMin");
    if (amountMax.trim()) {
      const cents = Math.round(Number(amountMax.replace(",", ".")) * 100);
      if (Number.isFinite(cents)) next.set("amountMax", String(cents));
    } else next.delete("amountMax");
    setOrDelete(
      "categoryIds",
      categoryIds.length > 0 ? categoryIds.join(",") : undefined,
    );
    setOrDelete(
      "accountIds",
      accountIds.length > 0 ? accountIds.join(",") : undefined,
    );
    setOrDelete("uncategorized", uncategorized ? "1" : undefined);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function reset() {
    setFrom(undefined);
    setTo(undefined);
    setSearch("");
    setAmountMin("");
    setAmountMax("");
    setCategoryIds([]);
    setAccountIds([]);
    setUncategorized(false);
    startTransition(() => router.push(pathname));
  }

  function toggle<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  const activeCount = [
    from,
    to,
    search,
    amountMin,
    amountMax,
    categoryIds.length > 0 ? "x" : null,
    accountIds.length > 0 ? "x" : null,
    uncategorized ? "x" : null,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4" />
          Filtres
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-7">
            <X className="mr-1 size-3" /> Réinitialiser
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="search">Recherche</Label>
        <Input
          id="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Description…"
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
      </div>

      <div className="space-y-2">
        <Label>Période</Label>
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "justify-start text-left font-normal",
                !from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 size-3" />
              {from ? format(from, "dd/MM/yyyy") : "Du"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={from} onSelect={setFrom} locale={fr} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "justify-start text-left font-normal",
                !to && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 size-3" />
              {to ? format(to, "dd/MM/yyyy") : "Au"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={to} onSelect={setTo} locale={fr} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Montant (€)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            inputMode="decimal"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            placeholder="Min"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
          <Input
            inputMode="decimal"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            placeholder="Max"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Catégories</Label>
          <button
            type="button"
            onClick={() => setUncategorized((v) => !v)}
            className={cn(
              "text-xs",
              uncategorized
                ? "text-primary underline"
                : "text-muted-foreground hover:underline",
            )}
          >
            Non catégorisées seulement
          </button>
        </div>
        <ScrollArea className="h-44 rounded-md border">
          <div className="space-y-1 p-2">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent"
              >
                <Checkbox
                  checked={categoryIds.includes(c.id)}
                  onCheckedChange={() =>
                    setCategoryIds((arr) => toggle(arr, c.id))
                  }
                  disabled={uncategorized}
                />
                <CategoryBadge category={c} />
              </label>
            ))}
          </div>
        </ScrollArea>
      </div>

      {accounts.length > 1 && (
        <div className="space-y-2">
          <Label>Comptes</Label>
          <div className="space-y-1">
            {accounts.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={accountIds.includes(a.id)}
                  onCheckedChange={() => setAccountIds((arr) => toggle(arr, a.id))}
                />
                <span>{a.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Button onClick={applyFilters} className="w-full">
        Appliquer
      </Button>
    </div>
  );
}
