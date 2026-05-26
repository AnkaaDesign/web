import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDownload, IconTrash } from "@tabler/icons-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { routes } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { useDeleteAssinatura, useDownloadAssinaturasZip } from "../../../../hooks";
import { cn } from "@/lib/utils";

export interface SecullumAssinatura {
  Id: number;
  Descricao: string;
  DataInicio: string;
  DataFim: string;
  DataInclusao: string;
  NumeroCartoes: number;
  Aprovados: number;
  Rejeitados: number;
  Compactada: boolean;
}

interface AssinaturaTableProps {
  apuracoes: SecullumAssinatura[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

export function AssinaturaTable({
  apuracoes,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: AssinaturaTableProps) {
  const navigate = useNavigate();
  const deleteMut = useDeleteAssinatura();
  const downloadZipMut = useDownloadAssinaturasZip();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number[] | null>(null);

  // Drop selections for rows no longer present (e.g. after delete/refetch).
  useEffect(() => {
    const present = new Set(apuracoes.map((a) => a.Id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [apuracoes]);

  // Close the context menu on any outside click / escape.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const allOnPageSelected = apuracoes.length > 0 && apuracoes.every((a) => selected.has(a.Id));
  const someOnPageSelected = apuracoes.some((a) => selected.has(a.Id));

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const everySelected = apuracoes.every((a) => next.has(a.Id));
      if (everySelected) apuracoes.forEach((a) => next.delete(a.Id));
      else apuracoes.forEach((a) => next.add(a.Id));
      return next;
    });
  }, [apuracoes]);

  const openContextMenu = useCallback(
    (e: React.MouseEvent, rowId: number) => {
      e.preventDefault();
      e.stopPropagation();
      // Act on the whole selection when right-clicking a selected row;
      // otherwise act on just this row (without disturbing the selection).
      const ids = selected.has(rowId) && selected.size > 0 ? [...selected] : [rowId];
      setContextMenu({ x: e.clientX, y: e.clientY, ids });
    },
    [selected],
  );

  const handleDownload = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      downloadZipMut.mutate(ids);
      setContextMenu(null);
    },
    [downloadZipMut],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    for (const id of pendingDelete) {
      try {
        await deleteMut.mutateAsync(id);
      } catch {
        // Per-id toast handled by the hook; keep deleting the rest.
      }
    }
    setSelected((prev) => {
      const next = new Set(prev);
      pendingDelete.forEach((id) => next.delete(id));
      return next;
    });
    setPendingDelete(null);
  }, [pendingDelete, deleteMut]);

  const deleteCount = pendingDelete?.length ?? 0;

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden h-full", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "bg-muted p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2 py-2">
                  <Checkbox
                    aria-label="Selecionar todos"
                    checked={allOnPageSelected}
                    indeterminate={!allOnPageSelected && someOnPageSelected}
                    onCheckedChange={() => toggleAllOnPage()}
                  />
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[90px] px-4 py-2">Número</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2">Descrição</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2">Início</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2">Fim</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[110px] px-4 py-2 text-right">Cartões</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2 text-right">Aprovados</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2 text-right">Rejeitados</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className="w-full table-fixed">
          <TableBody>
            {apuracoes.map((apuracao, index) => {
              const isSelected = selected.has(apuracao.Id);
              return (
                <TableRow
                  key={apuracao.Id}
                  className={cn(
                    "transition-colors border-b border-border cursor-pointer",
                    index % 2 === 1 && "bg-muted/10",
                    "hover:bg-muted/30",
                    isSelected && "bg-primary/10 hover:bg-primary/15",
                  )}
                  onClick={() => navigate(routes.humanResources.timeClock.assinaturaDigital.details(apuracao.Id))}
                  onContextMenu={(e) => openContextMenu(e, apuracao.Id)}
                >
                  <TableCell
                    className={cn(TABLE_LAYOUT.checkbox.className, "p-0")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center h-full w-full px-2 py-2">
                      <Checkbox
                        aria-label={`Selecionar apuração ${apuracao.Id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(apuracao.Id)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm w-[90px] px-4 py-2">{apuracao.Id}</TableCell>
                  <TableCell className="font-medium px-4 py-2 truncate">{apuracao.Descricao || "-"}</TableCell>
                  <TableCell className="w-[120px] px-4 py-2">{formatDate(apuracao.DataInicio)}</TableCell>
                  <TableCell className="w-[120px] px-4 py-2">{formatDate(apuracao.DataFim)}</TableCell>
                  <TableCell className="w-[110px] px-4 py-2 text-right tabular-nums">{apuracao.NumeroCartoes}</TableCell>
                  <TableCell className="w-[120px] px-4 py-2 text-right">
                    {apuracao.Aprovados > 0 ? (
                      <Badge variant="success" className="tabular-nums">{apuracao.Aprovados}</Badge>
                    ) : (
                      <span className="text-muted-foreground tabular-nums">0</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[120px] px-4 py-2 text-right">
                    {apuracao.Rejeitados > 0 ? (
                      <Badge variant="destructive" className="tabular-nums">{apuracao.Rejeitados}</Badge>
                    ) : (
                      <span className="text-muted-foreground tabular-nums">0</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[10, 20, 50, 100]}
          showPageSizeSelector={true}
          showGoToPage={totalPages > 5}
          showPageInfo={true}
        />
      </div>

      {/* Right-click context menu — anchored at the cursor */}
      {contextMenu && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <DropdownMenu open={true} onOpenChange={(o) => !o && setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onClick={() => handleDownload(contextMenu.ids)}
                disabled={downloadZipMut.isPending}
              >
                <IconDownload className="mr-2 h-4 w-4" />
                {downloadZipMut.isPending
                  ? "Baixando..."
                  : contextMenu.ids.length > 1
                    ? `Baixar cartões aprovados — ${contextMenu.ids.length} apurações`
                    : "Baixar cartões aprovados"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setPendingDelete(contextMenu.ids);
                  setContextMenu(null);
                }}
              >
                <IconTrash className="mr-2 h-4 w-4" />
                {contextMenu.ids.length > 1
                  ? `Remover apurações (${contextMenu.ids.length})`
                  : "Remover apuração"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && !deleteMut.isPending && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteCount > 1 ? `Remover ${deleteCount} apurações?` : "Remover apuração?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCount > 1
                ? `As ${deleteCount} apurações selecionadas serão removidas do Secullum, junto de todas as assinaturas vinculadas. Esta ação não pode ser desfeita.`
                : "A apuração será removida do Secullum, junto de todas as assinaturas vinculadas. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleConfirmDelete();
              }}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
