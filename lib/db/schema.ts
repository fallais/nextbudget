// Backwards-compatible type barrel.
//
// Table definitions now live in ./entities (TypeORM `EntitySchema`). This
// module re-exports the row types so existing
// `import type { X } from "@/lib/db/schema"` imports keep working.
export type {
  User,
  Session,
  Setting,
  Account,
  Category,
  Rule,
  Transaction,
  Person,
  Contribution,
  FixedExpense,
  Budget,
  Asset,
  AssetValuation,
  Import,
  NewTransaction,
  NewAccount,
} from "./entities";
