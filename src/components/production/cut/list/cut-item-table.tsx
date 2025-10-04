import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { IconFileOff } from "@tabler/icons-react";
import type { Cut } from "../../../../types";
import type { CutGetManyFormData } from "../../../../schemas";
import { useCuts, useCutMutations } from "../../../../hooks";
import { CUT_STATUS_LABELS, CUT_REQUEST_REASON_LABELS, CUT_ORIGIN_LABELS, CUT_TYPE_LABELS } from "../../../../constants";
import { CUT_STATUS, CUT_REQUEST_REASON, CUT_ORIGIN, routes } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CutRequestModal } from "./cut-request-modal";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { cn } from "@/lib/utils";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconChevronUp, IconChevronDown, IconSelector, IconScissors } from "@tabler/icons-react";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { CutItemListSkeleton } from "./cut-item-list-skeleton";
import { CutTableContextMenu, type CutAction } from "./cut-table-context-menu";
import { FilePreviewCard } from "@/components/file";
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

interface CutItemTableProps {
  filters?: Partial<CutGetManyFormData>;
  className?: string;
  onDataChange?: (data: { items: Cut[]; totalRecords: number }) => void;
}

export function CutItemTable({ filters = {}, className, onDataChange }: CutItemTableProps) {
  const navigate = useNavigate();
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedCutItem, setSelectedCutItem] = useState<Cut | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; items: Cut[] }>({
    open: false,
    items: [],
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Cut[];
    isBulk: boolean;
  } | null>(null);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    resetSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Include configuration for API calls
  const includeConfig = React.useMemo(
    () => ({
      task: {
        include: {
          customer: true,
        },
      },
      file: true,
      parentCut: {
        include: {
          file: true,
        },
      },
    }),
    [],
  );

  // Build query params
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page, // Already 1-based from useTableState
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, only show selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds],
  );

  const { data: response, isLoading, error } = useCuts(queryParams);
  const mutations = useCutMutations();

  const items = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      // Create a unique key for the current data to detect real changes
      const dataKey = items.length > 0 ? `${totalRecords}-${items.map((item: Cut) => item.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items, totalRecords });
      }
    }
  }, [items, totalRecords, onDataChange]);

  // Helper functions
  const formatDateDisplay = (dateString: string | Date | null) => {
    if (!dateString) return "-";

    const date = new Date(dateString);

    if (isToday(date)) {
      return format(date, "HH:mm");
    } else if (isYesterday(date)) {
      return "Ontem";
    } else {
      return format(date, "dd/MM");
    }
  };

  const getTaskName = (item: Cut) => {
    if (item.task?.name) {
      return item.task.name;
    }
    return "-";
  };

  const getSourceType = (item: Cut) => {
    return CUT_ORIGIN_LABELS[item.origin];
  };

  const getReason = (item: Cut) => {
    if (item.reason) {
      return CUT_REQUEST_REASON_LABELS[item.reason];
    }
    return item.origin === CUT_ORIGIN.PLAN ? "Plano de corte" : "Solicitação";
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, item: Cut) => {
    e.preventDefault();
    e.stopPropagation();

    // Validate item
    if (!item || !item.id) {
      console.error("Invalid item passed to handleContextMenu:", item);
      return;
    }

    // Check if clicked item is part of selection
    const isItemSelected = isSelected(item.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      // Show bulk actions for all selected items
      const selectedItemsList = items.filter((i: Cut) => isSelected(i.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItemsList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked item
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [item],
        isBulk: false,
      });
    }
  };

  // Handle context menu actions
  const handleContextMenuAction = async (action: CutAction, items: Cut[]) => {
    switch (action) {
      case "view":
        if (items.length === 1) {
          // Navigate to cut details page
          navigate(routes.production.cutting.details(items[0].id));
        }
        break;

      case "edit":
        if (items.length === 1) {
          // For now, just show a message as there's no edit route defined
          toast.info("Edição de corte ainda não implementada");
        }
        break;

      case "start":
        // Update status to CUTTING for all selected items
        try {
          for (const item of items) {
            if (item.status === CUT_STATUS.PENDING) {
              await mutations.updateAsync({
                id: item.id,
                data: {
                  status: CUT_STATUS.CUTTING,
                  startedAt: new Date(),
                },
              });
            }
          }
          toast.success(`${items.length} corte(s) iniciado(s) com sucesso`);
        } catch (error) {
          toast.error("Erro ao iniciar corte(s)");
        }
        break;

      case "finish":
        // Update status to COMPLETED for all selected items
        try {
          for (const item of items) {
            if (item.status === CUT_STATUS.CUTTING) {
              await mutations.updateAsync({
                id: item.id,
                data: {
                  status: CUT_STATUS.COMPLETED,
                  completedAt: new Date(),
                },
              });
            }
          }
          toast.success(`${items.length} corte(s) finalizado(s) com sucesso`);
        } catch (error) {
          toast.error("Erro ao finalizar corte(s)");
        }
        break;

      case "request":
        if (items.length === 1) {
          setSelectedCutItem(items[0]);
          setRequestModalOpen(true);
        }
        break;

      case "delete":
        setDeleteDialog({ open: true, items });
        break;
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const itemsToDelete = deleteDialog.items;
    try {
      // Use Promise.all to delete all items
      await Promise.all(itemsToDelete.map((item) => mutations.deleteAsync(item.id)));
      toast.success(`${itemsToDelete.length} corte(s) excluído(s) com sucesso`);
      // Clear selection if items were selected
      if (itemsToDelete.some((item) => isSelected(item.id))) {
        resetSelection();
      }
    } catch (error) {
      toast.error("Erro ao excluir corte(s)");
    } finally {
      setDeleteDialog({ open: false, items: [] });
    }
  };

  const handleSubmitRequest = async (data: { quantity: number; reason: CUT_REQUEST_REASON }) => {
    if (!selectedCutItem) return;

    try {
      // Create multiple individual cuts based on quantity
      const cutsToCreate = Array.from({ length: data.quantity }, () => ({
        fileId: selectedCutItem.fileId,
        type: selectedCutItem.type,
        origin: CUT_ORIGIN.REQUEST,
        reason: data.reason,
        parentCutId: selectedCutItem.id,
        taskId: selectedCutItem.taskId,
      }));

      // Create cuts one by one or use batch creation if available
      for (const cutData of cutsToCreate) {
        await mutations.createAsync(cutData);
      }

      toast.success(`${data.quantity} novo(s) corte(s) criado(s) com sucesso`);

      setRequestModalOpen(false);
      setSelectedCutItem(null);
    } catch (error) {
      toast.error("Ocorreu um erro ao criar a solicitação de corte");
    }
  };

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return items.map((item: Cut) => item.id);
  }, [items]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageItemIds);
  };

  const handleSelectItem = (itemId: string) => {
    toggleSelection(itemId);
  };

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  if (isLoading) {
    return <CutItemListSkeleton />;
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all items"
                    disabled={isLoading || items.length === 0}
                  />
                </div>
              </TableHead>

              {/* File preview column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-20">
                <div className="flex items-center justify-center h-full min-h-[2.5rem] px-2 py-2">
                  <TruncatedTextWithTooltip text="ARQUIVO" />
                </div>
              </TableHead>

              {/* Task column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                <button
                  onClick={() => toggleSort("task.name")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  disabled={isLoading || items.length === 0}
                >
                  <TruncatedTextWithTooltip text="TAREFA" />
                  {renderSortIndicator("task.name")}
                </button>
              </TableHead>

              {/* Status column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-28">
                <button
                  onClick={() => toggleSort("status")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  disabled={isLoading || items.length === 0}
                >
                  <TruncatedTextWithTooltip text="STATUS" />
                  {renderSortIndicator("status")}
                </button>
              </TableHead>

              {/* Type column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                  <TruncatedTextWithTooltip text="TIPO" />
                </div>
              </TableHead>

              {/* Source column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                  <TruncatedTextWithTooltip text="ORIGEM" />
                </div>
              </TableHead>

              {/* Reason column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                  <TruncatedTextWithTooltip text="MOTIVO" />
                </div>
              </TableHead>

              {/* Started at column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                <button
                  onClick={() => toggleSort("startedAt")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  disabled={isLoading || items.length === 0}
                >
                  <TruncatedTextWithTooltip text="INICIADO EM" />
                  {renderSortIndicator("startedAt")}
                </button>
              </TableHead>

              {/* Completed at column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                <button
                  onClick={() => toggleSort("completedAt")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                  disabled={isLoading || items.length === 0}
                >
                  <TruncatedTextWithTooltip text="FINALIZADO EM" />
                  {renderSortIndicator("completedAt")}
                </button>
              </TableHead>

              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconScissors className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os cortes</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconScissors className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum item de corte encontrado</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: Cut, index: number) => {
                const itemIsSelected = isSelected(item.id);

                return (
                  <TableRow
                    key={item.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    onClick={() => navigate(routes.production.cutting.details(item.id))}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={itemIsSelected} onCheckedChange={() => handleSelectItem(item.id)} aria-label={`Select ${item.id}`} data-checkbox />
                      </div>
                    </TableCell>

                    {/* File preview column */}
                    <TableCell className="w-20 p-0 !border-r-0">
                      <div className="flex items-center justify-center px-2 py-2">
                        {item.file ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <FilePreviewCard file={item.file} size="xs" className="w-12 h-12" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted/20 flex items-center justify-center">
                            <IconFileOff className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Task column */}
                    <TableCell className="w-48 p-0 !border-r-0">
                      <div className="px-4 py-2">
                        <TruncatedTextWithTooltip text={getTaskName(item)} className="font-medium" />
                      </div>
                    </TableCell>

                    {/* Status column */}
                    <TableCell className="w-28 p-0 !border-r-0">
                      <div className="px-4 py-2">
                        <Badge variant={item.status === CUT_STATUS.PENDING ? "secondary" : item.status === CUT_STATUS.CUTTING ? "default" : "success"}>
                          {CUT_STATUS_LABELS[item.status]}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Type column */}
                    <TableCell className="w-32 p-0 !border-r-0">
                      <div className="px-4 py-2">
                        {item.type ? (
                          <div className="flex items-center gap-2">
                            <IconScissors className="h-4 w-4 text-muted-foreground" />
                            <span>{CUT_TYPE_LABELS[item.type]}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </div>
                    </TableCell>

                    {/* Source column */}
                    <TableCell className="w-32 p-0 !border-r-0">
                      <div className="px-4 py-2">
                        <Badge variant="outline">{getSourceType(item)}</Badge>
                      </div>
                    </TableCell>

                    {/* Reason column */}
                    <TableCell className="w-48 p-0 !border-r-0">
                      <div className="px-4 py-2">
                        <TruncatedTextWithTooltip text={getReason(item)} />
                      </div>
                    </TableCell>

                    {/* Started at column */}
                    <TableCell className="w-32 p-0 !border-r-0">
                      <div className="px-4 py-2 text-sm">{formatDateDisplay(item.startedAt)}</div>
                    </TableCell>

                    {/* Completed at column */}
                    <TableCell className="w-32 p-0 !border-r-0">
                      <div className="px-4 py-2 text-sm">{formatDateDisplay(item.completedAt)}</div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={page} // SimplePaginationAdvanced expects 0-based index
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>

      <CutRequestModal open={requestModalOpen} onOpenChange={setRequestModalOpen} onSubmit={handleSubmitRequest} cutItem={selectedCutItem} />

      {/* Context Menu */}
      <CutTableContextMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} onAction={handleContextMenuAction} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, items: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog.items.length > 1 ? "Excluir cortes" : "Excluir corte"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.items.length > 1
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} cortes? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja excluir este corte? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
