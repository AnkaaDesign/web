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
import { useSecullumDeleteAbsence } from "../../../../hooks";

import { Button } from "@/components/ui/button";
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
  isLoading?: boolean;
  onEdit?: (record: SecullumAggregatedAbsence) => void;
  emptyText?: string;
}

const fmt = (iso: string) => format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });

const daysBetween = (a: string, b: string) => {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
};

type ContextTarget =
  | { kind: "single"; record: SecullumAggregatedAbsence }
  | { kind: "group"; records: SecullumAggregatedAbsence[]; label: string };

export function AbsenceTable({
  absences,
  isLoading,
  onEdit,
  emptyText = "Nenhum registro encontrado",
}: AbsenceTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const deleteMut = useSecullumDeleteAbsence();

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
    } catch {
      // Error toast is emitted by the axios error interceptor.
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

  // Right-click context menu — app standard (see position-table.tsx).
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextTarget;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContextTarget | null>(null);

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

  const openContextMenu = useCallback(
    (e: React.MouseEvent, target: ContextTarget) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, target });
    },
    [],
  );

  return (
    <div className="rounded-lg flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
        <Table className="text-sm">
          <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className="w-10 p-0 bg-muted border-b border-border" />
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-[28%]">Colaborador</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-[14%]">Início</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-[14%]">Fim</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-[8%] text-center">Dias</TableHead>
              <TableHead className="text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border w-[36%]">Setor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : groups.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState text={emptyText} />
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g, index) => {
                const isOpen = expanded.has(g.groupId);
                const head = g.records[0];

                if (!g.isCollective) {
                  return (
                    <TableRow
                      key={g.groupId}
                      onContextMenu={(e) =>
                        openContextMenu(e, { kind: "single", record: head })
                      }
                      className={cn(
                        "cursor-context-menu transition-colors border-b border-border [&>td]:py-2",
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
                      <TableCell className="text-muted-foreground px-4">
                        {head.sectorName ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <>
                    <TableRow
                      key={g.groupId}
                      onContextMenu={(e) =>
                        openContextMenu(e, {
                          kind: "group",
                          records: g.records,
                          label: `${g.records.length} colaboradores`,
                        })
                      }
                      className={cn(
                        "cursor-context-menu transition-colors border-b border-border [&>td]:py-2",
                        "bg-muted/30 hover:bg-muted/40",
                      )}
                    >
                      <TableCell className="p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 mx-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(g.groupId);
                          }}
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
                      <TableCell className="text-muted-foreground px-4">-</TableCell>
                    </TableRow>
                    {isOpen &&
                      g.records.map((rec) => (
                        <TableRow
                          key={rec.Id}
                          onContextMenu={(e) =>
                            openContextMenu(e, { kind: "single", record: rec })
                          }
                          className="cursor-context-menu transition-colors border-b border-border [&>td]:py-2 hover:bg-muted/20"
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
                          <TableCell className="text-muted-foreground text-xs px-4">
                            {rec.sectorName ?? "-"}
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

      {contextMenu && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <DropdownMenu
            open={true}
            onOpenChange={(o) => !o && setContextMenu(null)}
          >
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {contextMenu.target.kind === "single" && onEdit && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      onEdit((contextMenu.target as { kind: "single"; record: SecullumAggregatedAbsence }).record);
                      setContextMenu(null);
                    }}
                  >
                    <IconEdit className="mr-2 h-4 w-4" />
                    Editar férias
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setPendingDelete(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                <IconTrash className="mr-2 h-4 w-4" />
                {contextMenu.target.kind === "group"
                  ? "Remover férias coletivas"
                  : "Remover férias"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "group"
                ? "Remover férias coletivas?"
                : "Remover férias?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "group"
                ? `Todos os ${pendingDelete.records.length} registros do grupo serão removidos do Secullum. Esta ação não pode ser desfeita.`
                : pendingDelete && (
                    <>
                      O registro de <strong>{pendingDelete.record.userName}</strong> de{" "}
                      {fmt(pendingDelete.record.Inicio)} a {fmt(pendingDelete.record.Fim)} será
                      removido do Secullum. Esta ação não pode ser desfeita.
                    </>
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDelete) return;
                if (pendingDelete.kind === "group") {
                  await handleDeleteGroup(pendingDelete.records);
                } else {
                  await handleDeleteOne(pendingDelete.record);
                }
                setPendingDelete(null);
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
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </TableCell>
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
