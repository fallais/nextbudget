import { EntitySchema } from "typeorm";
import type { AccountRow } from "@domain/entities";
import { bigintNumber, createdAt, id, owner } from "./columns";

export const AccountEntity = new EntitySchema<AccountRow>({
  name: "accounts",
  columns: {
    id,
    ...owner,
    kind: { type: "text", default: "personal" },
    name: { type: "text" },
    bank: { type: "text", nullable: true },
    iban: { type: "text", nullable: true },
    currency: { type: "text", default: "EUR" },
    openingBalanceCents: {
      name: "opening_balance_cents",
      type: "bigint",
      nullable: true,
      transformer: bigintNumber,
    },
    openingBalanceDate: { name: "opening_balance_date", type: "text", nullable: true },
    createdAt,
  },
});
