"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AccountKind } from "@domain/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCEPT = ".csv,.tsv,.txt";

export type ImportTarget = { id: number; name: string; kind: AccountKind };

/**
 * Default to the common account, then the first personal one. Never just
 * "whatever sorts first alphabetically": a mis-routed statement is annoying to
 * undo, since re-importing it into the right account is fine but the wrong
 * account keeps its copy until you delete those rows by hand.
 */
function defaultTarget(accounts: ImportTarget[]): string {
  if (accounts.length === 0) return "";
  const joint = accounts.find((a) => a.kind === "joint");
  return String((joint ?? accounts[0]).id);
}

export function ImportButton({ accounts = [] }: { accounts?: ImportTarget[] }) {
  const [isLoading, setIsLoading] = useState(false);
  const [accountId, setAccountId] = useState<string>(() => defaultTarget(accounts));
  const [, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(fileList)) {
        formData.append("files", file);
      }
      if (accountId) formData.append("accountId", accountId);
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      const data = (await res.json()) as {
        files: Array<{ filename: string; status: string }>;
        totals: { files: number; new: number; duplicate: number; error: number };
      };
      toast.success(`${data.totals.files} fichier(s) traité(s)`, {
        description: `${data.totals.new} nouvelles · ${data.totals.duplicate} doublons · ${data.totals.error} erreurs`,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Échec de l'import", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
      // Reset so selecting the same file again re-triggers onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-end gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {accounts.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="import-account">Compte de destination</Label>
          <Select
            value={accountId}
            items={Object.fromEntries(accounts.map((a) => [String(a.id), a.name]))}
            onValueChange={(v) => v && setAccountId(String(v))}
          >
            <SelectTrigger id="import-account" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Upload className="mr-2 size-4" />
        )}
        {isLoading ? "Import en cours…" : "Importer"}
      </Button>
    </div>
  );
}
