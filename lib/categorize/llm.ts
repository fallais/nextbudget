/**
 * v2: LLM-based categorization for transactions that no rule matched.
 *
 * Implementation deferred. Wire a provider here (Claude, OpenAI, Mistral, …)
 * and have it return a category id from the existing list — never create
 * categories on the fly. Keep results auditable and rate-limited.
 */
import type { Category, Transaction } from "@/lib/db/schema";

export type LlmCategorizationResult = {
  categoryId: number | null;
  confidence: number;
  reason?: string;
};

export async function categorizeWithLlm(
  _transaction: Pick<Transaction, "description" | "amountCents" | "date">,
  _availableCategories: Pick<Category, "id" | "name">[],
): Promise<LlmCategorizationResult> {
  throw new Error("LLM categorization not implemented (v2 feature)");
}
