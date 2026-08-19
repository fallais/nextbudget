/**
 * v2: PDF statement parsing.
 *
 * To enable: `npm install unpdf`, then extract text with
 * `extractText` and write a heuristic line-by-line parser
 * (date + description + amount per line). Bank PDFs vary
 * heavily in layout, so target one bank at a time.
 */
import { emptyMapping, type CsvPreview, type ParseResult } from "./csv-generic";

const NOT_YET = "Le support PDF arrivera en v2 — exporter en CSV pour l'instant";

export function parsePdf(_buffer: Buffer): Promise<ParseResult> {
  return Promise.resolve({
    rows: [],
    errors: [{ row: 0, message: NOT_YET }],
    mapping: emptyMapping(),
  });
}

/** No columns to confirm: the mapping step shows the same refusal. */
export function previewPdf(_buffer: Buffer): Promise<CsvPreview> {
  return Promise.resolve({
    headers: [],
    mapping: emptyMapping(),
    missing: ["date", "description", "amount"],
    sample: [],
    errors: [{ row: 0, message: NOT_YET }],
    rowsTotal: 0,
    rowsError: 0,
  });
}
