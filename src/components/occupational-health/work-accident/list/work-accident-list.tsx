import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconAlertTriangle, IconClipboardList, IconEye, IconTrash, IconLoader2 } from "@tabler/icons-react";

import { WORK_ACCIDENT_REPORT_TYPE_LABELS, routes } from "../../../../constants";
import type { WORK_ACCIDENT_REPORT_TYPE } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { useWorkAccidentReports, useWorkAccidentReportMutations } from "../../../../hooks/occupational-health/use-work-accidents";
import type { WorkAccidentReport } from "@/types/work-accident";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WorkAccidentListProps {
  className?: string;
}

export function WorkAccidentList({ className }: WorkAccidentListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkAccidentReport | null>(null);

  const { deleteAsync, deleteMutation } = useWorkAccidentReportMutations();

  const { data: response, isLoading, error } = useWorkAccidentReports({
    orderBy: { accidentDate: "desc" },
    include: { user: { include: { position: true } } },
    ...(search.trim() ? { searchingFor: search.trim() } : {}),
    limit: 100,
  } as any);

  const reports = useMemo(() => response?.data || [], [response?.data]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting CAT:", err);
      }
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <TableSearchInput value={search} onChange={setSearch} placeholder="Buscar: colaborador, nº da CAT ou descrição" />

        <div className="flex-1 min-h-0 overflow-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
              <IconAlertTriangle className="h-8 w-8 mb-4" />
              <div className="text-lg font-medium mb-2">Não foi possível carregar as CATs</div>
              <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <IconClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <div className="text-lg font-medium mb-2">Nenhuma CAT registrada</div>
              <div className="text-sm">Registre a primeira Comunicação de Acidente de Trabalho.</div>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="text-foreground font-bold uppercase text-xs">Colaborador</TableHead>
                    <TableHead className="text-foreground font-bold uppercase text-xs">Tipo</TableHead>
                    <TableHead className="text-foreground font-bold uppercase text-xs">Nº da CAT</TableHead>
                    <TableHead className="text-foreground font-bold uppercase text-xs">Data do acidente</TableHead>
                    <TableHead className="text-foreground font-bold uppercase text-xs">Emissão</TableHead>
                    <TableHead className="text-foreground font-bold uppercase text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report, index) => (
                    <TableRow
                      key={report.id}
                      className={cn("border-b border-border cursor-pointer", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
                      onClick={() => navigate(routes.occupationalHealth.workAccidents.details(report.id))}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="truncate">{report.user?.name || "-"}</p>
                          {report.user?.position?.name && <p className="text-xs text-muted-foreground truncate">{report.user.position.name}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {WORK_ACCIDENT_REPORT_TYPE_LABELS[report.type as WORK_ACCIDENT_REPORT_TYPE] || report.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{report.catNumber || "-"}</TableCell>
                      <TableCell className="text-sm">{report.accidentDate ? formatDate(new Date(report.accidentDate)) : "-"}</TableCell>
                      <TableCell className="text-sm">{report.emissionDate ? formatDate(new Date(report.emissionDate)) : "-"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(routes.occupationalHealth.workAccidents.details(report.id))} title="Detalhes">
                            <IconEye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(report)} title="Excluir">
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a CAT{deleteTarget?.user?.name ? ` de "${deleteTarget.user.name}"` : ""}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
