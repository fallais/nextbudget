/** The record of one statement upload. */
export interface ImportRow {
  id: number;
  filename: string;
  parser: string;
  startedAt: Date;
  finishedAt: Date | null;
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  rowsError: number;
  status: "success" | "partial" | "error";
  errorMessage: string | null;
}
