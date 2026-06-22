import { parseCsv } from "./csv-generic";
import { parsePdf } from "./pdf-generic";
import type { ParseResult } from "./csv-generic";

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
): Promise<ParseResult> {
  switch (parserId) {
    case "csv-generic":
      return parseCsv(buffer.toString("utf8"));
    case "pdf-generic":
      return parsePdf(buffer);
  }
}
