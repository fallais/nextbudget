/**
 * v2: PDF statement parsing.
 *
 * To enable: `npm install unpdf`, then extract text with
 * `extractText` and write a heuristic line-by-line parser
 * (date + description + amount per line). Bank PDFs vary
 * heavily in layout, so target one bank at a time.
 */
import type { ParseResult } from "./csv-generic";

export function parsePdf(_buffer: Buffer): Promise<ParseResult> {
  return Promise.resolve({
    rows: [],
    errors: [{ row: 0, message: "Le support PDF arrivera en v2 — exporter en CSV pour l'instant" }],
    detectedColumns: { date: "", description: "" },
    delimiter: "",
  });
}
