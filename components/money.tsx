import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { MONEY } from "@shared/palette";
import { formatCents } from "@shared/format";

/**
 * A signed amount, rendered so its direction survives colour blindness.
 *
 * The green/red pair used for income and expense fails colour-vision
 * separation (ΔE 4.1 for deuteranopes) and cannot be restepped to pass — red
 * against green is *the* confusable pair. So colour is never the only cue
 * here: the sign is always printed, and `arrow` adds a second, non-colour
 * channel wherever the figure stands alone without a column header or a label
 * to explain it.
 *
 * Amounts are stored signed already, so this costs nothing.
 */
export function Money({
  cents,
  arrow = false,
  /** Force a direction — for a magnitude stored unsigned, like a budget spend. */
  direction,
  strong = false,
  size,
}: {
  cents: number;
  arrow?: boolean;
  direction?: "in" | "out" | "neutral";
  strong?: boolean;
  size?: number;
}) {
  const dir = direction ?? (cents > 0 ? "in" : cents < 0 ? "out" : "neutral");
  const color =
    dir === "in" ? MONEY.income : dir === "out" ? MONEY.expense : undefined;

  return (
    <span
      style={{
        color,
        fontWeight: strong ? 600 : undefined,
        fontSize: size,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {arrow && dir === "in" && <ArrowUpOutlined aria-hidden style={{ marginInlineEnd: 4 }} />}
      {arrow && dir === "out" && <ArrowDownOutlined aria-hidden style={{ marginInlineEnd: 4 }} />}
      {formatCents(cents)}
    </span>
  );
}

/** Figures in a table column, where the header already says what they are. */
export function Amount({ cents }: { cents: number }) {
  return <Money cents={cents} />;
}
