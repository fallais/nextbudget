"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ACCEPT = ".csv,.tsv,.txt";

export function ImportButton() {
  const [isLoading, setIsLoading] = useState(false);
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
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
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
    </>
  );
}
