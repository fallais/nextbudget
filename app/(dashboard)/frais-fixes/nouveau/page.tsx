import { listAllCategories } from "@application/queries";
import { NewFixedExpenseForm } from "@/components/fixed-expenses/new-fixed-expense-form";
import type { FixedExpenseDraft } from "@/components/fixed-expenses/fixed-expense-form";
import { EXPENSE_CADENCES, type ExpenseCadence } from "@domain/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function int(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Anything else in the URL is not a cadence, whoever put it there. */
function cadence(raw: string | undefined): ExpenseCadence | undefined {
  return EXPENSE_CADENCES.find((c) => c === raw);
}

/**
 * A blank form, or one filled in from a charge the app spotted.
 *
 * The detected charge travels in the URL rather than being written straight
 * to the table: what arrives is a median amount and a guessed pattern, and
 * both deserve a look before the app starts telling you they were not paid.
 */
export default async function NewFixedExpensePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const amountCents = int(get("amountCents"));
  // Only the keys actually present: an undefined spread over the form's own
  // defaults still overrides them, which would empty the tolerance field
  // rather than leave it at ten.
  const draft: FixedExpenseDraft = Object.fromEntries(
    Object.entries({
      name: get("name"),
      matchPattern: get("pattern"),
      cadence: cadence(get("cadence")),
      dueMonth: int(get("dueMonth")),
      expectedAmount: amountCents === undefined ? undefined : amountCents / 100,
      dueDay: int(get("dueDay")),
      categoryId: int(get("categoryId")),
      tolerancePct: int(get("tolerancePct")),
    }).filter(([, v]) => v !== undefined),
  );
  const filled = Object.keys(draft).length > 0;

  return (
    <NewFixedExpenseForm
      categories={await listAllCategories()}
      draft={filled ? draft : undefined}
    />
  );
}
