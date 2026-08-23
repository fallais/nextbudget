import type { ImportRow } from "@domain/entities";

/** What an import turned out to be, once it has run. */
export type ImportOutcome = {
  status: "success" | "error" | "partial";
  /** Absent when the run died before it could count anything. */
  rowsTotal?: number;
  rowsNew?: number;
  rowsDuplicate?: number;
  rowsError?: number;
  errorMessage?: string | null;
};

/**
 * The record of files fed to the app.
 *
 * A row is written *before* the parsing starts and finished afterwards, so a
 * crash half way through leaves evidence rather than silence: an import stuck
 * on `success` with no counts is a run that died, and that is worth being able
 * to see on the import screen.
 */
export interface ImportRepository {
  /** Open a record and return its id. */
  start(filename: string, parser: string): Promise<number>;

  /** Close it with what happened. */
  finish(importId: number, outcome: ImportOutcome): Promise<void>;

  listRecent(limit: number): Promise<ImportRow[]>;
}
