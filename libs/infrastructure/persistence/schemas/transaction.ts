import { EntitySchema } from "typeorm";
import type { TransactionRow } from "@domain/entities";
import { bigintNumber, createdAt, id } from "./columns";

export const TransactionEntity = new EntitySchema<TransactionRow>({
  name: "transactions",
  columns: {
    id,
    accountId: { name: "account_id", type: Number },
    categoryId: { name: "category_id", type: Number, nullable: true },
    date: { type: "text" },
    description: { type: "text" },
    normalizedDescription: { name: "normalized_description", type: "text" },
    amountCents: { name: "amount_cents", type: "bigint", transformer: bigintNumber },
    currency: { type: "text", default: "EUR" },
    hash: { type: "text" },
    sourceFile: { name: "source_file", type: "text", nullable: true },
    raw: { type: "jsonb", nullable: true },
    createdAt,
  },
  indices: [
    { name: "transactions_date_idx", columns: ["date"] },
    { name: "transactions_category_idx", columns: ["categoryId"] },
    { name: "transactions_account_idx", columns: ["accountId"] },
    // Dedup is per account, not global. The hash stays a pure content
    // fingerprint — two people can genuinely pay the same merchant the same
    // amount on the same day from different accounts, and a global unique
    // index would silently drop the second one on import.
    {
      name: "transactions_account_hash_uniq",
      columns: ["accountId", "hash"],
      unique: true,
    },
  ],
});
