import { listTransactions } from "@application/queries";
import Papa from "papaparse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIntList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const { rows } = await listTransactions(
    {
      from: sp.get("from"),
      to: sp.get("to"),
      categoryIds: parseIntList(sp.get("categoryIds")),
      accountIds: parseIntList(sp.get("accountIds")),
      uncategorized: sp.get("uncategorized") === "1",
      search: sp.get("search") ?? undefined,
      amountMin: sp.get("amountMin")
        ? Number.parseInt(sp.get("amountMin")!, 10)
        : undefined,
      amountMax: sp.get("amountMax")
        ? Number.parseInt(sp.get("amountMax")!, 10)
        : undefined,
    },
    { page: 1, pageSize: 100_000 },
  );

  const csv = Papa.unparse(
    rows.map((r) => ({
      Date: r.date,
      Description: r.description,
      Catégorie: r.category?.name ?? "",
      Compte: r.account?.name ?? "",
      "Montant (€)": (r.amountCents / 100).toFixed(2).replace(".", ","),
    })),
    { delimiter: ";" },
  );

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
