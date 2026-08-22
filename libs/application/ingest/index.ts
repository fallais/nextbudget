import "server-only";
import { getDataSource } from "@infrastructure/persistence/client";
import { ImportEntity, TransactionEntity, AccountEntity } from "@infrastructure/persistence/schemas";
import type { NewTransaction } from "@domain/entities";
import { isUniqueViolation } from "@infrastructure/persistence/errors";
import { detectParser, previewParser, runParser, type ParserId } from "@infrastructure/ingest/parsers/registry";
import type { ColumnMapping, CsvPreview } from "@infrastructure/ingest/parsers/csv-generic";
import { transactionHash } from "@infrastructure/ingest/hash";
import { fingerprintKey, planImport, type Fingerprintable } from "@infrastructure/ingest/dedup";
import { loadActiveCompiledRules, matchCategoryId } from "@application/categorize/engine";

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
};

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
  const ds = await getDataSource();
  const accRepo = ds.getRepository(AccountEntity);
  const existing = await accRepo.find({ order: { id: "ASC" }, take: 1 });
  if (existing.length > 0) return existing[0].id;
  const created = await accRepo.save(accRepo.create({ name: "Compte courant" }));
  return created.id;
}

/** Resolve the requested account, falling back to the default. */
async function resolveAccount(requestedId?: number | null): Promise<number> {
  if (requestedId == null) return getOrCreateDefaultAccount();
  const ds = await getDataSource();
  const found = await ds.getRepository(AccountEntity).findOne({ where: { id: requestedId } });
  if (!found) throw new Error(`Compte introuvable (id ${requestedId})`);
  return found.id;
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

  const ds = await getDataSource();
  const raw = await ds
    .getRepository(TransactionEntity)
    .createQueryBuilder("t")
    .select("t.date", "date")
    .addSelect("t.amountCents", "amountCents")
    .addSelect("t.normalizedDescription", "normalizedDescription")
    .addSelect("COUNT(*)", "count")
    .where("t.accountId = :accountId", { accountId })
    .andWhere("t.date BETWEEN :from AND :to", { from, to })
    .groupBy("t.date")
    .addGroupBy("t.amountCents")
    .addGroupBy("t.normalizedDescription")
    .getRawMany<{
      date: string;
      amountCents: string;
      normalizedDescription: string;
      count: string;
    }>();

  return new Map(
    raw.map((r) => [
      fingerprintKey({
        date: r.date,
        amountCents: Number(r.amountCents),
        normalizedDescription: r.normalizedDescription,
      }),
      Number(r.count),
    ]),
  );
}

async function ingestOne(
  file: UploadedFile,
  accountId: number,
  mapping: Partial<ColumnMapping> = {},
): Promise<IngestFileResult> {
  const { filename, buffer } = file;
  const parserId = detectParser(filename);

  if (!parserId) {
    return {
      filename,
      parser: null,
      status: "error",
      rowsTotal: 0,
      rowsNew: 0,
      rowsDuplicate: 0,
      rowsError: 0,
      errorMessage: "Format de fichier non reconnu",
    };
  }

  const ds = await getDataSource();
  const impRepo = ds.getRepository(ImportEntity);
  const txRepo = ds.getRepository(TransactionEntity);

  const importRow = await impRepo.save(
    impRepo.create({ filename, parser: parserId, status: "success" }),
  );
  const importId = importRow.id;

  try {
    const parsed = await runParser(parserId, buffer, mapping);

    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      const message = parsed.errors[0].message;
      await impRepo.update(importId, {
        status: "error",
        rowsTotal: 0,
        rowsError: parsed.errors.length,
        errorMessage: message,
        finishedAt: new Date(),
      });
      return {
        filename,
        parser: parserId,
        status: "error",
        rowsTotal: 0,
        rowsNew: 0,
        rowsDuplicate: 0,
        rowsError: parsed.errors.length,
        errorMessage: message,
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
      };
      try {
        await txRepo.save(txRepo.create(value));
        rowsNew++;
      } catch (err: unknown) {
        // The plan already accounted for what is on file; this is the net for
        // a second import running against the same account at the same time.
        if (isUniqueViolation(err)) {
          rowsDuplicate++;
        } else {
          throw err;
        }
      }
    }

    const status: "success" | "partial" = rowsError > 0 ? "partial" : "success";

    await impRepo.update(importId, {
      status,
      rowsTotal: parsed.rows.length + rowsError,
      rowsNew,
      rowsDuplicate,
      rowsError,
      finishedAt: new Date(),
      errorMessage: rowsError > 0 ? `${rowsError} ligne(s) en erreur` : null,
    });

    return {
      filename,
      parser: parserId,
      status,
      rowsTotal: parsed.rows.length + rowsError,
      rowsNew,
      rowsDuplicate,
      rowsError,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await impRepo.update(importId, {
      status: "error",
      errorMessage: message,
      finishedAt: new Date(),
    });
    return {
      filename,
      parser: parserId,
      status: "error",
      rowsTotal: 0,
      rowsNew: 0,
      rowsDuplicate: 0,
      rowsError: 0,
      errorMessage: message,
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
  for (const f of files) {
    results.push(await ingestOne(f, accountId, mappings[f.filename] ?? {}));
  }
  return {
    files: results,
    totals: {
      files: results.length,
      new: results.reduce((a, r) => a + r.rowsNew, 0),
      duplicate: results.reduce((a, r) => a + r.rowsDuplicate, 0),
      error: results.reduce((a, r) => a + r.rowsError, 0),
    },
  };
}
