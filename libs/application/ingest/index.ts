import "server-only";
import { accounts, imports, transactions } from "@infrastructure/persistence/repositories";
import type { ImportRepository, TransactionRepository } from "@domain/repositories";
import type { NewTransaction } from "@domain/entities";
import { isUniqueViolation } from "@infrastructure/persistence/errors";
import { detectParser, previewParser, runParser, type ParserId } from "@infrastructure/ingest/parsers/registry";
import type { ColumnMapping, CsvPreview } from "@infrastructure/ingest/parsers/csv-generic";
import { transactionHash } from "@infrastructure/ingest/hash";
import { fingerprintKey, planImport, type Fingerprintable } from "@infrastructure/ingest/dedup";
import { loadActiveCompiledRules, matchCategoryId } from "@application/categorize/engine";
import { detectTransfers } from "@application/transfers";

export type UploadedFile = {
  filename: string;
  buffer: Buffer;
};

export type IngestFileResult = {
  filename: string;
  parser: string | null;
  status: "success" | "partial" | "error";
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  rowsError: number;
  errorMessage?: string;
};

export type IngestRunResult = {
  files: IngestFileResult[];
  totals: { files: number; new: number; duplicate: number; error: number };
  /** Pairs of legs the run recognised as moves between your own accounts. */
  transfersDetected: number;
};

/** The span a statement covers, which is what bounds the search for pairs. */
type DateSpan = { from: string; to: string };

/** A column mapping per filename — how the confirm step overrules detection. */
export type MappingsByFile = Record<string, Partial<ColumnMapping>>;

export type FilePreview = {
  filename: string;
  parser: ParserId | null;
  preview: CsvPreview | null;
  /** Set when the file cannot be read at all, e.g. an unsupported extension. */
  error?: string;
};

/**
 * Read the uploads without writing anything.
 *
 * The import page shows this back — which column it took for the date, for the
 * libellé, for the amount — and lets it be corrected before a single row is
 * written. Detection is a first guess, not a verdict: a wrong guess used to
 * mean a wrong import to undo by hand, and every unknown bank meant a new
 * parser rather than four selects.
 */
export async function previewUploads(
  files: UploadedFile[],
  mappings: MappingsByFile = {},
): Promise<FilePreview[]> {
  return Promise.all(
    files.map(async ({ filename, buffer }) => {
      const parserId = detectParser(filename);
      if (!parserId) {
        return {
          filename,
          parser: null,
          preview: null,
          error: "Format de fichier non reconnu",
        };
      }
      return {
        filename,
        parser: parserId,
        preview: await previewParser(parserId, buffer, mappings[filename] ?? {}),
      };
    }),
  );
}


/**
 * Fallback when the caller names no account: the oldest one, or a fresh
 * "Compte courant" on an empty install. Only a fallback — with more than one
 * account the caller is expected to say which, otherwise every statement
 * would pile into whichever account happens to be first.
 */
async function getOrCreateDefaultAccount(): Promise<number> {
  const existing = await accounts.findAll();
  if (existing.length > 0) return existing[0].toRow().id;
  const created = await accounts.create({ name: "Compte courant" } as never);
  return created.toRow().id;
}

/** Resolve the requested account, falling back to the default. */
async function resolveAccount(requestedId?: number | null): Promise<number> {
  if (requestedId == null) return getOrCreateDefaultAccount();
  const found = await accounts.findById(requestedId);
  if (!found) throw new Error(`Compte introuvable (id ${requestedId})`);
  return found.toRow().id;
}

/**
 * How many times each fingerprint the file carries already exists in this
 * account.
 *
 * One grouped query over the span the statement covers, rather than a lookup
 * per row: a statement is a month or a year, so its date range is what bounds
 * the work. `date` is ISO text, which orders lexicographically — the same
 * property the month buckets elsewhere rely on.
 */
async function existingOccurrences(
  accountId: number,
  rows: Fingerprintable[],
): Promise<Map<string, number>> {
  if (rows.length === 0) return new Map();
  const dates = rows.map((r) => r.date);
  const from = dates.reduce((a, b) => (a < b ? a : b));
  const to = dates.reduce((a, b) => (a > b ? a : b));

  const raw = await transactions.countFingerprintsInRange(accountId, from, to);
  return new Map(raw.map((r) => [fingerprintKey(r), r.count]));
}

/**
 * One file, plus the span of dates it turned out to cover.
 *
 * The span is not decoration: it is what keeps the search for transfer pairs
 * proportional to the statement just read rather than to every statement ever
 * imported.
 */
async function ingestOne(
  file: UploadedFile,
  accountId: number,
  mapping: Partial<ColumnMapping> = {},
): Promise<{ result: IngestFileResult; span: DateSpan | null }> {
  const { filename, buffer } = file;
  const parserId = detectParser(filename);

  if (!parserId) {
    return {
      span: null,
      result: {
        filename,
        parser: null,
        status: "error",
        rowsTotal: 0,
        rowsNew: 0,
        rowsDuplicate: 0,
        rowsError: 0,
        errorMessage: "Format de fichier non reconnu",
      },
    };
  }

  const importId = await imports.start(filename, parserId);

  try {
    const parsed = await runParser(parserId, buffer, mapping);

    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      const message = parsed.errors[0].message;
      await imports.finish(importId, {
        status: "error",
        rowsTotal: 0,
        rowsError: parsed.errors.length,
        errorMessage: message,
      });
      return {
        span: null,
        result: {
          filename,
          parser: parserId,
          status: "error",
          rowsTotal: 0,
          rowsNew: 0,
          rowsDuplicate: 0,
          rowsError: parsed.errors.length,
          errorMessage: message,
        },
      };
    }

    const compiledRules = await loadActiveCompiledRules();

    const plan = planImport(parsed.rows, await existingOccurrences(accountId, parsed.rows));

    let rowsNew = 0;
    // Rows the account already holds. A lookalike is not one of them: it is a
    // later occurrence of the same fingerprint, and gets written.
    let rowsDuplicate = plan.duplicates;
    const rowsError = parsed.errors.length;

    for (const { row, occurrence } of plan.write) {
      const hash = transactionHash({
        date: row.date,
        amountCents: row.amountCents,
        normalizedDescription: row.normalizedDescription,
        occurrence,
      });
      const categoryId = matchCategoryId(row.normalizedDescription, row.amountCents, compiledRules);
      const value: NewTransaction = {
        accountId,
        categoryId,
        date: row.date,
        description: row.description,
        normalizedDescription: row.normalizedDescription,
        amountCents: row.amountCents,
        currency: "EUR",
        hash,
        sourceFile: filename,
        raw: (row.raw ?? null) as Record<string, unknown> | null,
        // Pairing needs both legs on file, and the counterpart may arrive in
        // this very run. It happens once, after the whole upload is written.
        transferGroupId: null,
      };
      if (await transactions.insertImported(value)) rowsNew++;
      else rowsDuplicate++;
    }

    const status: "success" | "partial" = rowsError > 0 ? "partial" : "success";

    await imports.finish(importId, {
      status,
      rowsTotal: parsed.rows.length + rowsError,
      rowsNew,
      rowsDuplicate,
      rowsError,
      errorMessage: rowsError > 0 ? `${rowsError} ligne(s) en erreur` : null,
    });

    const dates = parsed.rows.map((r) => r.date);
    return {
      span: dates.length
        ? { from: dates.reduce((a, b) => (a < b ? a : b)), to: dates.reduce((a, b) => (a > b ? a : b)) }
        : null,
      result: {
        filename,
        parser: parserId,
        status,
        rowsTotal: parsed.rows.length + rowsError,
        rowsNew,
        rowsDuplicate,
        rowsError,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await imports.finish(importId, {
      status: "error",
      errorMessage: message,
    });
    return {
      span: null,
      result: {
        filename,
        parser: parserId,
        status: "error",
        rowsTotal: 0,
        rowsNew: 0,
        rowsDuplicate: 0,
        rowsError: 0,
        errorMessage: message,
      },
    };
  }
}

export async function ingestUploads(
  files: UploadedFile[],
  targetAccountId?: number | null,
  mappings: MappingsByFile = {},
): Promise<IngestRunResult> {
  const accountId = await resolveAccount(targetAccountId);
  const results: IngestFileResult[] = [];
  const spans: DateSpan[] = [];
  for (const f of files) {
    const { result, span } = await ingestOne(f, accountId, mappings[f.filename] ?? {});
    results.push(result);
    if (span) spans.push(span);
  }

  // After every file, not after each one: the debit and the credit of a
  // transfer often arrive in the same upload, one statement per account, and
  // pairing halfway through would only find the legs written so far.
  const written = results.reduce((a, r) => a + r.rowsNew, 0);
  const span = spans.length
    ? {
        from: spans.map((s) => s.from).reduce((a, b) => (a < b ? a : b)),
        to: spans.map((s) => s.to).reduce((a, b) => (a > b ? a : b)),
      }
    : null;
  const transfers = written > 0 && span ? await detectTransfers(span) : { pairs: 0 };

  return {
    files: results,
    totals: {
      files: results.length,
      new: written,
      duplicate: results.reduce((a, r) => a + r.rowsDuplicate, 0),
      error: results.reduce((a, r) => a + r.rowsError, 0),
    },
    transfersDetected: transfers.pairs,
  };
}
