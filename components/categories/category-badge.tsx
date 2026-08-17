import { cn } from "@shared/utils";
import { getCategoryIcon } from "@shared/category-icons";
import type { CategoryRow } from "@domain/entities";

export function CategoryBadge({
  category,
  size = "sm",
  className,
}: {
  category: Pick<CategoryRow, "name" | "color" | "icon"> | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!category) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        Non catégorisée
      </span>
    );
  }
  const Icon = getCategoryIcon(category.icon);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
      style={{
        borderColor: `${category.color}55`,
        backgroundColor: `${category.color}1a`,
        color: category.color,
      }}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      <span className="text-foreground/90">{category.name}</span>
    </span>
  );
}
