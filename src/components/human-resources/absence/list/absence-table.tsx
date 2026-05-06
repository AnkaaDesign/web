import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconTrash,
  IconUsers,
  IconCalendarOff,
} from "@tabler/icons-react";

import type { SecullumAggregatedAbsence } from "../../../../types";
import { groupAbsences } from "../../../../types";
import { getJustificativaMeta, TONE_CLASSES } from "../../../../constants";
import { useSecullumDeleteAbsence } from "../../../../hooks";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface AbsenceTableProps {
  absences: SecullumAggregatedAbsence[];
  // When provided, the table renders one row per (absence × work-day) instead
  // of one row per absence record. Used by the Faltas page so a 91-day atestado
  // appears as ~60 rows (one per work-day in the visible period).
  dayRows?: Array<SecullumAggregatedAbsence & { dayDate: Date }>;
  isLoading?: boolean;
  onEdit?: (record: SecullumAggregatedAbsence) => void;
  emptyText?: string;
}

const fmt = (iso: string) => format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });

// Brazilian short weekday labels with period suffix (matches "Seg.", "Ter.", etc.)
const WEEKDAY_SHORT_PT = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];

const daysBetween = (a: string, b: string) => {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
};

export function AbsenceTable({
  absences,
  dayRows,
  isLoading,
  onEdit,
  emptyText = "Nenhum registro encontrado",
}: AbsenceTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const deleteMut = useSecullumDeleteAbsence();
  const isPerDayMode = Array.isArray(dayRows);

  const groups = useMemo(() => groupAbsences(absences), [absences]);

  const toggleExpand = (groupId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleDeleteOne = async (rec: SecullumAggregatedAbsence) => {
    try {
      await deleteMut.mutateAsync(rec.Id);
      toast.success("Afastamento removido");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Falha ao remover");
    }
  };

  const handleDeleteGroup = async (records: SecullumAggregatedAbsence[]) => {
    let ok = 0;
    let fail = 0;
    for (const r of records) {
      try {
        await deleteMut.mutateAsync(r.Id);
        ok++;
      } catch {
        fail++;
      }
    }
    if (fail === 0) toast.success(`${ok} registros removidos`);
    else toast.warning(`${ok} removidos, ${fail} falharam`);
  };

  // Right-click context menu state for the per-day Faltas table — matches the
  // app's standard pattern (see position-table.tsx).
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    record: SecullumAggregatedAbsence;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SecullumAggregatedAbsence | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu]);

  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, record: SecullumAggregatedAbsence) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, record });
    },
    [],
  );

  if (isPerDayMode) {
    return (
      <div className="rounded-lg flex flex-col overflow-hidden h-full">
        <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
          <Table className="text-sm">
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0 [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Data</TableHead>
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Colaborador</TableHead>
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Justificativa</TableHead>
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Setor</TableHead>
                <TableHead className="text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <PerDaySkeletonRows />
              ) : (dayRows?.length ?? 0) === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState text={emptyText} />
                  </TableCell>
                </TableRow>
              ) : (
                dayRows!.map((row, index) => {
                  const meta = getJustificativaMeta(row.JustificativaId);
                  return (
                    <TableRow
                      key={`${row.Id}-${row.dayDate.toISOString()}`}
                      onContextMenu={(e) => handleRowContextMenu(e, row)}
                      className={cn(
                        "cursor-context-menu transition-colors border-b border-border [&>td]:py-2",
                        index % 2 === 1 && "bg-muted/10",
                        "hover:bg-muted/20",
                      )}
                    >
                      <TableCell className="tabular-nums font-medium whitespace-nowrap px-4">
                        {format(row.dayDate, "dd/MM/yy", { locale: ptBR })} -{" "}
                        {WEEKDAY_SHORT_PT[row.dayDate.getDay()]}
                      </TableCell>
                      <TableCell className="font-medium px-4">{row.userName}</TableCell>
                      <TableCell className="px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal border-0",
                            meta && TONE_CLASSES[meta.tone].bg,
                            meta && TONE_CLASSES[meta.tone].text,
                          )}
                        >
                          {meta?.label ?? row.JustificativaDescricao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4">
                        {row.sectorName ?? "-"}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground truncate max-w-[260px] px-4"
                        title={row.Motivo ?? ""}
                      >
                        {row.Motivo || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {contextMenu && (
          <div className="fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <DropdownMenu open={true} onOpenChange={(o) => !o && setContextMenu(null)}>
              <DropdownMenuTrigger asChild>
                <div className="w-0 h-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {onEdit && (
                  <DropdownMenuItem
                    onClick={() => {
                      onEdit(contextMenu.record);
                      setContextMenu(null);
                    }}
                  >
                    <IconEdit className="mr-2 h-4 w-4" />
                    Editar registro
                  </DropdownMenuItem>
                )}
                {onEdit && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setPendingDelete(contextMenu.record);
                    setContextMenu(null);
                  }}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Remover registro completo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover registro de afastamento?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete && (
                  <>
                    Esta ação remove o registro completo de{" "}
                    <strong>{pendingDelete.userName}</strong> de{" "}
                    {format(new Date(pendingDelete.Inicio), "dd/MM/yyyy", { locale: ptBR })} a{" "}
                    {format(new Date(pendingDelete.Fim), "dd/MM/yyyy", { locale: ptBR })}, não apenas
                    este dia. Esta ação não pode ser desfeita.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (pendingDelete) {
                    await handleDeleteOne(pendingDelete);
                    setPendingDelete(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="rounded-lg flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
        <Table className="text-sm">
          <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className="w-10 p-0 bg-muted border-b border-border" />
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Colaborador</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-28">Início</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-28">Fim</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-16 text-center">Dias</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Justificativa</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Setor</TableHead>
              <TableHead className="text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border">Motivo</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-24 text-right pr-3">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : groups.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="p-0">
                  <EmptyState text={emptyText} />
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g, index) => {
                const meta = getJustificativaMeta(g.justificativaId);
                const isOpen = expanded.has(g.groupId);
                const head = g.records[0];

                if (!g.isCollective) {
                  return (
                    <TableRow
                      key={g.groupId}
                      className={cn(
                        "transition-colors border-b border-border [&>td]:py-2",
                        index % 2 === 1 && "bg-muted/10",
                        "hover:bg-muted/20",
                      )}
                    >
                      <TableCell />
                      <TableCell className="font-medium px-4">{head.userName}</TableCell>
                      <TableCell className="tabular-nums px-4">{fmt(head.Inicio)}</TableCell>
                      <TableCell className="tabular-nums px-4">{fmt(head.Fim)}</TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground px-4">
                        {daysBetween(head.Inicio, head.Fim)}
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal border-0",
                            meta && TONE_CLASSES[meta.tone].bg,
                            meta && TONE_CLASSES[meta.tone].text,
                          )}
                        >
                          {meta?.label ?? head.JustificativaDescricao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4">
                        {head.sectorName ?? "-"}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground truncate max-w-[260px] px-4"
                        title={g.motivo}
                      >
                        {g.motivo || "-"}
                      </TableCell>
                      <TableCell className="text-right pr-3">
                        <RowActions
                          onEdit={onEdit ? () => onEdit(head) : undefined}
                          onDelete={() => handleDeleteOne(head)}
                          deleteTitle="Remover afastamento?"
                          deleteDescription={`Esta ação não pode ser desfeita. O registro de ${head.userName} de ${fmt(head.Inicio)} a ${fmt(head.Fim)} será removido do Secullum.`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <>
                    <TableRow
                      key={g.groupId}
                      className={cn(
                        "transition-colors border-b border-border [&>td]:py-2",
                        "bg-muted/30 hover:bg-muted/40",
                      )}
                    >
                      <TableCell className="p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 mx-auto"
                          onClick={() => toggleExpand(g.groupId)}
                          aria-label={isOpen ? "Recolher grupo" : "Expandir grupo"}
                        >
                          {isOpen ? (
                            <IconChevronDown className="h-4 w-4" />
                          ) : (
                            <IconChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium px-4">
                        <div className="flex items-center gap-2">
                          <IconUsers className="h-4 w-4 text-muted-foreground" />
                          Coletiva ·{" "}
                          <span className="text-muted-foreground font-normal">
                            {g.records.length} colaboradores
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums px-4">{fmt(head.Inicio)}</TableCell>
                      <TableCell className="tabular-nums px-4">{fmt(head.Fim)}</TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground px-4">
                        {daysBetween(head.Inicio, head.Fim)}
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal border-0",
                            meta && TONE_CLASSES[meta.tone].bg,
                            meta && TONE_CLASSES[meta.tone].text,
                          )}
                        >
                          {meta?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4">-</TableCell>
                      <TableCell
                        className="text-muted-foreground truncate max-w-[260px] px-4"
                        title={g.motivo}
                      >
                        {g.motivo || "-"}
                      </TableCell>
                      <TableCell className="text-right pr-3">
                        <RowActions
                          onDelete={() => handleDeleteGroup(g.records)}
                          deleteTitle="Remover afastamento coletivo?"
                          deleteDescription={`Todos os ${g.records.length} registros do grupo serão removidos do Secullum. Esta ação não pode ser desfeita.`}
                        />
                      </TableCell>
                    </TableRow>
                    {isOpen &&
                      g.records.map((rec) => (
                        <TableRow
                          key={rec.Id}
                          className="transition-colors border-b border-border [&>td]:py-2 hover:bg-muted/20"
                        >
                          <TableCell />
                          <TableCell className="pl-10 text-muted-foreground">
                            ↳ {rec.userName}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground px-4">
                            {fmt(rec.Inicio)}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground px-4">
                            {fmt(rec.Fim)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-muted-foreground px-4">
                            {daysBetween(rec.Inicio, rec.Fim)}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-muted-foreground text-xs px-4">
                            {rec.sectorName ?? "-"}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right pr-3">
                            <RowActions
                              onEdit={onEdit ? () => onEdit(rec) : undefined}
                              onDelete={() => handleDeleteOne(rec)}
                              deleteTitle={`Remover registro de ${rec.userName}?`}
                              deleteDescription="Apenas este colaborador será removido do grupo."
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
}: {
  onEdit?: () => void;
  onDelete: () => void;
  deleteTitle: string;
  deleteDescription: string;
}) {
  return (
    <div className="flex justify-end items-center gap-0.5">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          aria-label="Editar"
        >
          <IconEdit className="h-4 w-4" />
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Remover"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PerDaySkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="[&>td]:py-2 border-b border-border hover:bg-transparent">
          <TableCell>
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded mt-1" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-40 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="[&>td]:py-2 border-b border-border hover:bg-transparent">
          <TableCell />
          <TableCell>
            <div className="h-4 w-40 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
          </TableCell>
          <TableCell>
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted/40 p-4 mb-4">
        <IconCalendarOff className="h-10 w-10 text-muted-foreground/60" />
      </div>
      <p className="text-base font-medium text-foreground/80">{text}</p>
      <p className="text-sm text-muted-foreground mt-1">
        Ajuste os filtros ou clique em <span className="font-medium">Adicionar</span> para criar um novo registro.
      </p>
    </div>
  );
}
