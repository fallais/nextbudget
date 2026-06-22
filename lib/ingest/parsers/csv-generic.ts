import Papa from "papaparse";
import { parse, isValid, formatISO } from "date-fns";
import { parseAmountToCents } from "@/lib/format";
import { normalizeDescription } from "@/lib/categorize/normalize";

export type ParsedRow = {
  date: string;
  description: string;
  normalizedDescription: string;
  amountCents: number;
  raw: Record<string, unknown>;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: Array<{ row: number; message: string }>;
  detectedColumns: {
    date: string;
    description: string;
    amount?: string;
    debit?: string;
    credit?: string;
  };
  delimiter: string;
};

const DATE_HEADER_HINTS = [
  "date",
  "date operation",
  "date d operation",
  "date valeur",
  "date comptable",
  "date de l operation",
];

const DESCRIPTION_HEADER_HINTS = [
  "libelle",
  "description",
  "intitule",
  "operation",
  "label",
  "detail",
  "communication",
];

const AMOUNT_HEADER_HINTS = ["montant", "amount"];
const DEBIT_HEADER_HINTS = ["debit", "depense", "sortie"];
const CREDIT_HEADER_HINTS = ["credit", "recette", "entree"];

const DATE_EXCLUSION = "date";

const DATE_FORMATS = [
  "dd/MM/yyyy",
  "dd/MM/yy",
  "yyyy-MM-dd",
  "yyyy/MM/dd",
  "dd-MM-yyyy",
  "dd.MM.yyyy",
];

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['_\-./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeader(
  headers: string[],
  hints: string[],
  options: { excludeContaining?: string } = {},
): string | undefined {
  const normMap = new Map(headers.map((h) => [normHeader(h), h]));
  // Exact match first
  for (const hint of hints) {
    if (normMap.has(hint)) return normMap.get(hint);
  }
  // Then partial, skipping any header that contains an excluded token
  for (const [n, original] of normMap.entries()) {
    if (options.excludeContaining && n.includes(options.excludeContaining)) continue;
    if (hints.some((hint) => n.includes(hint))) return original;
  }
  return undefined;
}

function tryParseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  for (const fmt of DATE_FORMATS) {
    const d = parse(v, fmt, new Date());
    if (isValid(d)) return formatISO(d, { representation: "date" });
  }
  return null;
}

function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts: Record<string, number> = {
    ";": (head.match(/;/g) || []).length,
    ",": (head.match(/,/g) || []).length,
    "\t": (head.match(/\t/g) || []).length,
  };
  let best = ";";
  let bestCount = -1;
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }
  return best;
}

function findHeaderRow(text: string, delimiter: string): number {
  const lines = text.split(/\r?\n/);
  // Heuristic: the first line that contains at least one date hint or amount hint
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const cells = lines[i].split(delimiter).map(normHeader);
    const hasDate = cells.some((c) => DATE_HEADER_HINTS.some((h) => c.includes(h)));
    const hasAmt = cells.some((c) =>
      [...AMOUNT_HEADER_HINTS, ...DEBIT_HEADER_HINTS, ...CREDIT_HEADER_HINTS].some(
        (h) => c.includes(h),
      ),
    );
    if (hasDate && hasAmt) return i;
  }
  return 0;
}

export function parseCsv(content: string): ParseResult {
  const errors: ParseResult["errors"] = [];
  const delimiter = detectDelimiter(content);
  const headerRowIndex = findHeaderRow(content, delimiter);

  // Drop pre-header rows (some banks include account info above)
  const usable =
    headerRowIndex === 0
      ? content
      : content.split(/\r?\n/).slice(headerRowIndex).join("\n");

  const parsed = Papa.parse<Record<string, string>>(usable, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  if (headers.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Aucun en-tête détecté" }],
      detectedColumns: { date: "", description: "" },
      delimiter,
    };
  }

  const dateCol = findHeader(headers, DATE_HEADER_HINTS);
  const descCol = findHeader(headers, DESCRIPTION_HEADER_HINTS, {
    excludeContaining: DATE_EXCLUSION,
  });
  const amountCol = findHeader(headers, AMOUNT_HEADER_HINTS, {
    excludeContaining: DATE_EXCLUSION,
  });
  const debitCol = findHeader(headers, DEBIT_HEADER_HINTS, {
    excludeContaining: DATE_EXCLUSION,
  });
  const creditCol = findHeader(headers, CREDIT_HEADER_HINTS, {
    excludeContaining: DATE_EXCLUSION,
  });

  if (!dateCol) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Colonne de date introuvable" }],
      detectedColumns: { date: "", description: descCol ?? "" },
      delimiter,
    };
  }
  if (!descCol) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Colonne de libellé introuvable" }],
      detectedColumns: { date: dateCol, description: "" },
      delimiter,
    };
  }
  if (!amountCol && !(debitCol || creditCol)) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Colonne(s) de montant introuvable(s)" }],
      detectedColumns: { date: dateCol, description: descCol },
      delimiter,
    };
  }

  const rows: ParsedRow[] = [];
  parsed.data.forEach((record, idx) => {
    const lineNo = idx + headerRowIndex + 2;
    try {
      const rawDate = (record[dateCol] ?? "").toString();
      const iso = tryParseDate(rawDate);
      if (!iso) throw new Error(`Date illisible: "${rawDate}"`);

      const description = (record[descCol] ?? "").toString().trim();
      if (!description) throw new Error("Libellé vide");

      let amountCents = 0;
      if (amountCol) {
        const raw = (record[amountCol] ?? "").toString();
        if (!raw.trim()) throw new Error("Montant vide");
        amountCents = parseAmountToCents(raw);
      } else {
        const debitRaw = (record[debitCol!] ?? "").toString().trim();
        const creditRaw = (record[creditCol!] ?? "").toString().trim();
        if (!debitRaw && !creditRaw) throw new Error("Débit et crédit vides");
        const debitCents = debitRaw ? parseAmountToCents(debitRaw) : 0;
        const creditCents = creditRaw ? parseAmountToCents(creditRaw) : 0;
        amountCents = creditCents - Math.abs(debitCents);
      }

      rows.push({
        date: iso,
        description,
        normalizedDescription: normalizeDescription(description),
        amountCents,
        raw: record,
      });
    } catch (err) {
      errors.push({
        row: lineNo,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return {
    rows,
    errors,
    detectedColumns: {
      date: dateCol,
      description: descCol,
      amount: amountCol,
      debit: debitCol,
      credit: creditCol,
    },
    delimiter,
  };
}
