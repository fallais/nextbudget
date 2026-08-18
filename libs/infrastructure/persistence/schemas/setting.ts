import { EntitySchema } from "typeorm";
import type { SettingRow } from "@domain/entities";

export const SettingEntity = new EntitySchema<SettingRow>({
  name: "settings",
  columns: {
    key: { type: "text", primary: true },
    value: { type: "jsonb", nullable: true },
  },
});
