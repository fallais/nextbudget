import Papa from "papaparse";
import { parse, isValid, formatISO } from "date-fns";
import { DATE_FORMATS, parseAmountToCents } from "@shared/format";
import { normalizeDescription } from "@domain/value-objects/normalized-description";

export type ParsedRow = {
  date: string;
  description: string;
  normalizedDescription: string;
  amountCents: number;
  raw: Record<string, unknown>;
};

/**
 * How one file's columns become transactions.
 *
 * Detection fills this in, and the import page shows it back before anything
 * is written — every field is therefore something a person can overrule. That
 * is what makes the parser generic: an unknown bank is not a new parser, it is
 * this object with different strings in it.
 */
export type ColumnMapping = {
  delimiter: string;
  /** Rows above this are account headers the bank put on top of its export. */
  headerRowIndex: number;
  date: string;
  description: string;
  /** Either one signed column… */
  amount: string | null;
  /** …or a debit/credit pair, which is how many French banks export. */
  debit: string | null;
  credit: string | null;
  /** `null` tries every known layout, row by row. */
  dateFormat: string | null;
  /** Some exports state expenses as positive numbers. */
  invertSign: boolean;
};

export type ParseError = { row: number; message: string };

export type ParseResult = {
  rows: ParsedRow[];
  errors: ParseError[];
  mapping: ColumnMapping;
};

/** What the mapping step needs to draw itself: the file, read but not imported. */
export type CsvPreview = {
  headers: string[];
  mapping: ColumnMapping;
  /** Which of "date" | "description" | "amount" could not be resolved. */
  missing: string[];
  sample: ParsedRow[];
  errors: ParseError[];
  rowsTotal: number;
  rowsError: number;
};

const DATE_HEADER_HINTS = [
  "date",
  "jour",
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

const DATE_PATTERNS = DATE_FORMATS.map((f) => f.value);

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
): string | null {
  const normMap = new Map(headers.map((h) => [normHeader(h), h]));
  // Exact match first
  for (const hint of hints) {
    const hit = normMap.get(hint);
    if (hit) return hit;
  }
  // Then partial, skipping any header that contains an excluded token
  for (const [n, original] of normMap.entries()) {
    if (options.excludeContaining && n.includes(options.excludeContaining)) continue;
    if (hints.some((hint) => n.includes(hint))) return original;
  }
  return null;
}

function tryParseDate(value: string, format: string | null): string | null {
  const v = value.trim();
  if (!v) return null;
  for (const fmt of format ? [format] : DATE_PATTERNS) {
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
    // Papaparse guesses the same four; a pipe export is rare but real, and
    // without it the whole line reads as a single column.
    "|": (head.match(/\|/g) || []).length,
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

type Layout = {
  headers: string[];
  records: Record<string, string>[];
  mapping: ColumnMapping;
  missing: string[];
};

/**
 * Read the shape of the file, letting anything the caller already decided win.
 *
 * An override naming a column the file does not have falls back to detection
 * rather than failing — a mapping saved against last month's export should not
 * break this month's because the bank renamed a column.
 */
function readLayout(content: string, override: Partial<ColumnMapping> = {}): Layout {
  const delimiter = override.delimiter || detectDelimiter(content);
  const headerRowIndex = override.headerRowIndex ?? findHeaderRow(content, delimiter);

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
  const headers = (parsed.meta.fields ?? []).filter((h) => h.length > 0);

  /** An overridden column only counts if the file actually has it. */
  const pick = (
    chosen: string | null | undefined,
    hints: string[],
    options: { excludeContaining?: string } = {},
  ): string | null => {
    if (chosen !== undefined) return chosen && headers.includes(chosen) ? chosen : null;
    return findHeader(headers, hints, options);
  };

  const amount = pick(override.amount, AMOUNT_HEADER_HINTS, {
    excludeContaining: DATE_EXCLUSION,
  });
  const debit = pick(override.debit, DEBIT_HEADER_HINTS, { excludeContaining: DATE_EXCLUSION });
  const credit = pick(override.credit, CREDIT_HEADER_HINTS, {
    excludeContaining: DATE_EXCLUSION,
  });

  const mapping: ColumnMapping = {
    delimiter,
    headerRowIndex,
    date: pick(override.date, DATE_HEADER_HINTS) ?? "",
    description:
      pick(override.description, DESCRIPTION_HEADER_HINTS, {
        excludeContaining: DATE_EXCLUSION,
      }) ?? "",
    amount,
    debit,
    credit,
    dateFormat: override.dateFormat ?? null,
    invertSign: override.invertSign ?? false,
  };

  const missing: string[] = [];
  if (!mapping.date) missing.push("date");
  if (!mapping.description) missing.push("description");
  if (!mapping.amount && !mapping.debit && !mapping.credit) missing.push("amount");

  return { headers, records: parsed.data, mapping, missing };
}

/** One record through the mapping. Throws a French message the UI can show. */
function toRow(record: Record<string, string>, mapping: ColumnMapping): ParsedRow {
  const rawDate = (record[mapping.date] ?? "").toString();
  const iso = tryParseDate(rawDate, mapping.dateFormat);
  if (!iso) throw new Error(`Date illisible : « ${rawDate} »`);

  const description = (record[mapping.description] ?? "").toString().trim();
  if (!description) throw new Error("Libellé vide");

  let amountCents: number;
  if (mapping.amount) {
    const raw = (record[mapping.amount] ?? "").toString();
    if (!raw.trim()) throw new Error("Montant vide");
    amountCents = parseAmountToCents(raw);
  } else {
    const debitRaw = (record[mapping.debit ?? ""] ?? "").toString().trim();
    const creditRaw = (record[mapping.credit ?? ""] ?? "").toString().trim();
    if (!debitRaw && !creditRaw) throw new Error("Débit et crédit vides");
    const debitCents = debitRaw ? parseAmountToCents(debitRaw) : 0;
    const creditCents = creditRaw ? parseAmountToCents(creditRaw) : 0;
    amountCents = creditCents - Math.abs(debitCents);
  }
  if (mapping.invertSign) amountCents = -amountCents;

  return {
    date: iso,
    description,
    normalizedDescription: normalizeDescription(description),
    amountCents,
    raw: record,
  };
}

const MISSING_MESSAGES: Record<string, string> = {
  date: "Colonne de date introuvable",
  description: "Colonne de libellé introuvable",
  amount: "Colonne(s) de montant introuvable(s)",
};

function convert(
  layout: Layout,
  onRow: (row: ParsedRow) => void,
  onError: (error: ParseError) => void,
): void {
  layout.records.forEach((record, idx) => {
    const lineNo = idx + layout.mapping.headerRowIndex + 2;
    try {
      onRow(toRow(record, layout.mapping));
    } catch (err) {
      onError({ row: lineNo, message: err instanceof Error ? err.message : String(err) });
    }
  });
}

export function parseCsv(content: string, override: Partial<ColumnMapping> = {}): ParseResult {
  const layout = readLayout(content, override);

  if (layout.headers.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "Aucun en-tête détecté" }], mapping: layout.mapping };
  }
  if (layout.missing.length > 0) {
    return {
      rows: [],
      errors: layout.missing.map((m) => ({ row: 0, message: MISSING_MESSAGES[m] })),
      mapping: layout.mapping,
    };
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  convert(layout, (r) => rows.push(r), (e) => errors.push(e));
  return { rows, errors, mapping: layout.mapping };
}

/**
 * The same read, stopping short of importing.
 *
 * Counts are over the whole file so the confirm button can say how many
 * transactions it is about to write; only the rows shown are capped.
 */
export function previewCsv(
  content: string,
  override: Partial<ColumnMapping> = {},
  sampleSize = 8,
): CsvPreview {
  const layout = readLayout(content, override);

  const base: CsvPreview = {
    headers: layout.headers,
    mapping: layout.mapping,
    missing: layout.missing,
    sample: [],
    errors: [],
    rowsTotal: layout.records.length,
    rowsError: 0,
  };
  if (layout.headers.length === 0) {
    return { ...base, missing: ["date", "description", "amount"], errors: [{ row: 0, message: "Aucun en-tête détecté" }] };
  }
  if (layout.missing.length > 0) return base;

  const sample: ParsedRow[] = [];
  const errors: ParseError[] = [];
  let rowsError = 0;
  convert(
    layout,
    (r) => {
      if (sample.length < sampleSize) sample.push(r);
    },
    (e) => {
      rowsError++;
      if (errors.length < sampleSize) errors.push(e);
    },
  );

  return { ...base, sample, errors, rowsError };
}

/** An empty mapping, for parsers that do not read columns at all. */
export function emptyMapping(): ColumnMapping {
  return {
    delimiter: "",
    headerRowIndex: 0,
    date: "",
    description: "",
    amount: null,
    debit: null,
    credit: null,
    dateFormat: null,
    invertSign: false,
  };
}
