"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  isPeriodKey,
  type PeriodKey,
} from "@domain/value-objects/period";

export function PeriodSelector({ defaultPeriod = "month" }: { defaultPeriod?: PeriodKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("period");
  const current: PeriodKey = isPeriodKey(raw) ? raw : defaultPeriod;

  function handleChange(value: string | null) {
    if (!value || !isPeriodKey(value)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Select value={current} items={PERIOD_LABELS} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]" aria-label="Période">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((p) => (
          <SelectItem key={p} value={p}>
            {PERIOD_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
