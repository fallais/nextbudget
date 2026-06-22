import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `${numberFormatter.format(v / 1_000_000)} M€`;
  if (Math.abs(v) >= 10_000) return `${numberFormatter.format(v / 1_000)} k€`;
  return currencyFormatter.format(v);
}

export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(n)} %`;
}

export function formatDateLong(iso: string): string {
  return format(parseISO(iso), "d MMMM yyyy", { locale: fr });
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy", { locale: fr });
}

export function formatMonthLabel(iso: string): string {
  return format(parseISO(iso), "MMM yyyy", { locale: fr });
}

export function parseAmountToCents(input: string): number {
  // Accept "1234,56", "1 234,56", "-1234.56", "(1234.56)" (negative)
  let s = input.trim();
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  s = s.replace(/\s/g, "").replace(/ /g, "");
  // If both `,` and `.` present, treat the last one as decimal separator
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Cannot parse amount: ${input}`);
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}
