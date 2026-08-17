"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@shared/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CategoryBadge } from "@/components/categories/category-badge";
import { getCategoryIcon } from "@shared/category-icons";
import type { CategoryRow } from "@domain/entities";

export function CategoryCell({
  transactionId,
  current,
  categories,
}: {
  transactionId: number;
  current: Pick<CategoryRow, "id" | "name" | "color" | "icon"> | null;
  categories: CategoryRow[];
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleSelect(categoryId: number | null) {
    setOpen(false);
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      toast.success(categoryId === null ? "Catégorie retirée" : "Catégorie mise à jour");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de la mise à jour", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Modifier la catégorie"
      >
        <CategoryBadge category={current} />
        <ChevronDown className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher une catégorie…" />
          <CommandList>
            <CommandEmpty>Aucune catégorie</CommandEmpty>
            <CommandGroup>
              {categories.map((c) => {
                const Icon = getCategoryIcon(c.icon);
                const selected = current?.id === c.id;
                return (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => handleSelect(c.id)}
                  >
                    <span
                      className="mr-2 inline-flex size-4 items-center justify-center rounded"
                      style={{ backgroundColor: `${c.color}33`, color: c.color }}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="flex-1">{c.name}</span>
                    {selected && <Check className="size-4" />}
                  </CommandItem>
                );
              })}
              {current && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => handleSelect(null)}
                  className="text-muted-foreground"
                >
                  <X className="mr-2 size-4" />
                  Retirer la catégorie
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
