"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#16a34a",
  "#10b981",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#dc2626",
  "#a16207",
  "#64748b",
  "#94a3b8",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{ backgroundColor: c }}
            className={cn(
              "size-7 rounded-md border-2 transition-transform hover:scale-110",
              c.toLowerCase() === value.toLowerCase()
                ? "border-foreground"
                : "border-transparent",
            )}
            aria-label={c}
          />
        ))}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#16a34a"
        className="font-mono text-xs"
        maxLength={7}
      />
    </div>
  );
}
