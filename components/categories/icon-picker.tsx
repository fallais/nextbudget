"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ICON_OPTIONS, getCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (next: string) => void;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  const Selected = getCategoryIcon(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}
      >
        <Selected className="mr-2 size-4" style={color ? { color } : undefined} />
        {value}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="h-48">
          <div className="grid grid-cols-6 gap-1">
            {Object.entries(ICON_OPTIONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-accent",
                  name === value && "border-primary bg-accent",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
