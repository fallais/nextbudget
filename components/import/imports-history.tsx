import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Import } from "@/lib/db/schema";

const statusMeta: Record<
  Import["status"],
  { label: string; icon: typeof CheckCircle2; variant: "default" | "secondary" | "destructive" }
> = {
  success: { label: "Succès", icon: CheckCircle2, variant: "secondary" },
  partial: { label: "Partiel", icon: AlertCircle, variant: "default" },
  error: { label: "Erreur", icon: XCircle, variant: "destructive" },
};

export function ImportsHistory({ imports }: { imports: Import[] }) {
  if (imports.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucun import pour l'instant. Cliquez sur « Importer » pour téléverser vos
        relevés CSV.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fichier</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Nouvelles</TableHead>
            <TableHead className="text-right">Doublons</TableHead>
            <TableHead className="text-right">Erreurs</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.map((row) => {
            const meta = statusMeta[row.status];
            const Icon = meta.icon;
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{row.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.parser}
                      {row.errorMessage ? ` · ${row.errorMessage}` : ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={meta.variant} className="gap-1">
                    <Icon className="size-3" />
                    {meta.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.rowsTotal}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {row.rowsNew}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.rowsDuplicate}
                </TableCell>
                <TableCell className="text-right tabular-nums text-destructive">
                  {row.rowsError}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(row.startedAt, "d MMM yyyy, HH:mm", { locale: fr })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
