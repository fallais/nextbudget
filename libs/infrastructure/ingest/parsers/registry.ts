import { parseCsv, previewCsv } from "./csv-generic";
import { parsePdf, previewPdf } from "./pdf-generic";
import type { ColumnMapping, CsvPreview, ParseResult } from "./csv-generic";

export type ParserId = "csv-generic" | "pdf-generic";

export function detectParser(filename: string): ParserId | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    return "csv-generic";
  }
  if (lower.endsWith(".pdf")) return "pdf-generic";
  return null;
}

export async function runParser(
  parserId: ParserId,
  buffer: Buffer,
  mapping: Partial<ColumnMapping> = {},
): Promise<ParseResult> {
  switch (parserId) {
    case "csv-generic":
      return parseCsv(buffer.toString("utf8"), mapping);
    case "pdf-generic":
      return parsePdf(buffer);
  }
}

/** Read the file far enough to show what was recognised, importing nothing. */
export async function previewParser(
  parserId: ParserId,
  buffer: Buffer,
  mapping: Partial<ColumnMapping> = {},
): Promise<CsvPreview> {
  switch (parserId) {
    case "csv-generic":
      return previewCsv(buffer.toString("utf8"), mapping);
    case "pdf-generic":
      return previewPdf(buffer);
  }
}
