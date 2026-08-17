import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  formatISO,
} from "date-fns";

export type PeriodKey = "month" | "3m" | "year" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "Mois en cours",
  "3m": "3 derniers mois",
  year: "Année en cours",
  all: "Tout",
};

export const PERIOD_OPTIONS: PeriodKey[] = ["month", "3m", "year", "all"];

function toIsoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export function periodToRange(
  period: PeriodKey,
  now: Date = new Date(),
): { from: string | null; to: string | null } {
  switch (period) {
    case "month":
      return { from: toIsoDate(startOfMonth(now)), to: toIsoDate(endOfMonth(now)) };
    case "3m":
      return {
        from: toIsoDate(startOfMonth(subMonths(now, 2))),
        to: toIsoDate(endOfMonth(now)),
      };
    case "year":
      return { from: toIsoDate(startOfYear(now)), to: toIsoDate(endOfYear(now)) };
    case "all":
      return { from: null, to: null };
  }
}

export function previousPeriodRange(
  period: PeriodKey,
  now: Date = new Date(),
): { from: string | null; to: string | null } {
  switch (period) {
    case "month": {
      const prev = subMonths(now, 1);
      return { from: toIsoDate(startOfMonth(prev)), to: toIsoDate(endOfMonth(prev)) };
    }
    case "3m": {
      const prevTo = endOfMonth(subMonths(now, 3));
      const prevFrom = startOfMonth(subMonths(now, 5));
      return { from: toIsoDate(prevFrom), to: toIsoDate(prevTo) };
    }
    case "year": {
      const prev = new Date(now.getFullYear() - 1, 0, 1);
      return { from: toIsoDate(startOfYear(prev)), to: toIsoDate(endOfYear(prev)) };
    }
    case "all":
      return { from: null, to: null };
  }
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === "string" && PERIOD_OPTIONS.includes(value as PeriodKey);
}
