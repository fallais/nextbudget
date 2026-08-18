"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "antd";
import {
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  isPeriodKey,
  type PeriodKey,
} from "@domain/value-objects/period";

/**
 * The dashboard's period. A Segmented rather than a Select: there are only a
 * few periods and they are switched constantly, so every option should be one
 * click away instead of behind a menu.
 */
export function PeriodSelector({ defaultPeriod = "month" }: { defaultPeriod?: PeriodKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("period");
  const current: PeriodKey = isPeriodKey(raw) ? raw : defaultPeriod;

  return (
    <Segmented
      value={current}
      onChange={(value) => {
        if (!isPeriodKey(value as string)) return;
        const next = new URLSearchParams(searchParams.toString());
        next.set("period", value as string);
        router.push(`${pathname}?${next.toString()}`);
      }}
      options={PERIOD_OPTIONS.map((key) => ({ value: key, label: PERIOD_LABELS[key] }))}
    />
  );
}
