import { EntitySchema } from "typeorm";
import type { ImportRow } from "@domain/entities";
import { id } from "./columns";

export const ImportEntity = new EntitySchema<ImportRow>({
  name: "imports",
  columns: {
    id,
    filename: { type: "text" },
    parser: { type: "text" },
    startedAt: { name: "started_at", type: "timestamptz", createDate: true },
    finishedAt: { name: "finished_at", type: "timestamptz", nullable: true },
    rowsTotal: { name: "rows_total", type: Number, default: 0 },
    rowsNew: { name: "rows_new", type: Number, default: 0 },
    rowsDuplicate: { name: "rows_duplicate", type: Number, default: 0 },
    rowsError: { name: "rows_error", type: Number, default: 0 },
    status: { type: "text", default: "success" },
    errorMessage: { name: "error_message", type: "text", nullable: true },
  },
});
