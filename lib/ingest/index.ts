import "server-only";
import { getDataSource } from "@/lib/db/client";
import {
  ImportEntity,
  TransactionEntity,
  AccountEntity,
  type NewTransaction,
} from "@/lib/db/entities";
import { detectParser, runParser } from "./parsers/registry";
import { transactionHash } from "./hash";
import { loadActiveCompiledRules, matchCategoryId } from "@/lib/categorize/engine";

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

/** Postgres unique_violation. Used to detect duplicate transaction hashes. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string }; message?: string };
  return (
    e?.code === "23505" ||
    e?.driverError?.code === "23505" ||
    (typeof e?.message === "string" && e.message.includes("duplicate key"))
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

async function ingestOne(file: UploadedFile, accountId: number): Promise<IngestFileResult> {
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
    const parsed = await runParser(parserId, buffer);

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

    let rowsNew = 0;
    let rowsDuplicate = 0;
    const rowsError = parsed.errors.length;

    for (const row of parsed.rows) {
      const hash = transactionHash({
        date: row.date,
        amountCents: row.amountCents,
        normalizedDescription: row.normalizedDescription,
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
): Promise<IngestRunResult> {
  const accountId = await resolveAccount(targetAccountId);
  const results: IngestFileResult[] = [];
  for (const f of files) {
    results.push(await ingestOne(f, accountId));
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
