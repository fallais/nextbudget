import { createHash } from "node:crypto";

export function transactionHash(args: {
  date: string;
  amountCents: number;
  normalizedDescription: string;
}): string {
  const payload = `${args.date}|${args.amountCents}|${args.normalizedDescription}`;
  return createHash("sha256").update(payload).digest("hex");
}
