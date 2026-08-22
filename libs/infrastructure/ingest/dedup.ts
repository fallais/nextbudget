/**
 * How many of a file's rows are actually new.
 *
 * Dedup used to be one insert per row and a unique violation counted as a
 * duplicate, which cannot tell a statement imported twice from a statement
 * that genuinely bills the same merchant the same amount twice in one day.
 * The second reading is the common one, and it silently dropped real
 * transactions.
 *
 * So count instead of collapse. A fingerprint appearing `k` times in the file
 * and `e` times already in the account is short by `k - e` rows: skip the
 * first `e`, write the rest as occurrences `e … k-1`. Re-importing the same
 * file leaves `k = e` and writes nothing; a file overlapping one already
 * imported reconciles to the higher count rather than doubling it.
 */

export type Fingerprintable = {
  date: string;
  amountCents: number;
  normalizedDescription: string;
};

/** The key the bank statement cannot distinguish rows by. */
export function fingerprintKey(row: Fingerprintable): string {
  return `${row.date}|${row.amountCents}|${row.normalizedDescription}`;
}

export type PlannedRow<T> = { row: T; occurrence: number };

export type ImportPlan<T> = {
  /** In file order, each with the occurrence its hash must carry. */
  write: PlannedRow<T>[];
  /** Rows this account already holds — a real re-import, not a lookalike. */
  duplicates: number;
};

/**
 * @param rows     one file's rows, in the order the bank exported them
 * @param existing occurrences already stored per fingerprint, for this account
 */
export function planImport<T extends Fingerprintable>(
  rows: T[],
  existing: Map<string, number>,
): ImportPlan<T> {
  const seen = new Map<string, number>();
  const write: PlannedRow<T>[] = [];
  let duplicates = 0;

  for (const row of rows) {
    const key = fingerprintKey(row);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);

    // The first `existing` occurrences are already on file; only what the
    // account is short of gets written.
    if (occurrence < (existing.get(key) ?? 0)) {
      duplicates++;
      continue;
    }
    write.push({ row, occurrence });
  }

  return { write, duplicates };
}
