import { Entity } from "@domain/ddd";
import { invariant } from "@domain/errors";

export interface CategoryRow {
  id: number;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: Date;
}

export type NewCategory = Omit<CategoryRow, "id" | "createdAt">;

export class Category extends Entity<CategoryRow> {
  private constructor(row: CategoryRow) {
    super(row);
  }

  static reconstitute(row: CategoryRow): Category {
    return new Category(row);
  }

  static create(input: NewCategory): Category {
    invariant(input.name.trim().length > 0, "Le nom est obligatoire.", "category.name_required");
    invariant(
      /^#[0-9a-fA-F]{6}$/.test(input.color),
      "La couleur doit être un code hexadécimal, par exemple #16a34a.",
      "category.color_invalid",
    );
    return new Category({ ...input, id: 0, createdAt: new Date() });
  }

  get name(): string {
    return this.row.name;
  }

}
