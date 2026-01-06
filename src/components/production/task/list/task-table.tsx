import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "../../../../types";
import { routes, TASK_STATUS } from "../../../../constants";
import { isValidTaskStatusTransition, getTaskStatusLabel } from "../../../../utils";
import { shouldShowInteractiveElements, canEditTasks, canDeleteTasks } from "@/utils/permissions/entity-permissions";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconRefresh, IconEdit, IconTrash, IconSelector, IconPlayerPlay, IconCheck, IconPlayerPause, IconX, IconEye } from "@tabler/icons-react";
import { TaskListSkeleton } from "./task-list-skeleton";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { useTaskMutations, useTaskBatchMutations, useTasks } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { TaskGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { createTaskColumns } from "./task-table-columns";
import type { TaskColumn } from "./types";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { useToast } from "@/hooks/use-toast";
import { getRowColorClass } from "./task-table-utils";
import { TaskDuplicateModal } from "../modals/task-duplicate-modal";
import { TaskSetSectorModal } from "../modals/task-set-sector-modal";
import { IconCopy, IconBuildingFactory2 } from "@tabler/icons-react";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TaskTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (tasks: Task[]) => void;
  onStart?: (tasks: Task[]) => void;
  onFinish?: (tasks: Task[]) => void;
  onHold?: (tasks: Task[]) => void;
  onCancel?: (tasks: Task[]) => void;
  onDelete?: (tasks: Task[]) => void;
  filters?: Partial<TaskGetManyFormData>;
  onDataChange?: (data: { items: Task[]; totalRecords: number }) => void;
}

export function TaskTable({
  visibleColumns,
  className,
  onEdit,
  onStart: _onStart,
  onFinish: _onFinish,
  onHold: _onHold,
  onCancel: _onCancel,
  onDelete,
  filters = {},
  onDataChange,
}: TaskTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { update, delete: deleteTask } = useTaskMutations();
  const { batchUpdate, batchDelete } = useTaskBatchMutations();

  // Permission checks
  const { user } = useAuth();
  const canEdit = user ? canEditTasks(user) : false;
  const canDelete = user ? canDeleteTasks(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'task') : false;

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
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
    resetSelection: _resetSelection,
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      sector: true,
      customer: true,
      createdBy: true,
      services: true,
      files: true,
      observation: true,
      generalPainting: true,
      logoPaints: true,
      truck: true,
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
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

  // Use the tasks hook with memoized parameters
  const { data: response, isLoading, error } = useTasks(queryParams);

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
      const dataKey = items.length > 0 ? `${totalRecords}-${items.map((item) => item.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items, totalRecords });
      }
    }
  }, [items, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Task[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Duplicate modal state
  const [duplicateTask, setDuplicateTask] = useState<Task | null>(null);

  // Set sector modal state
  const [setSectorTasks, setSetSectorTasks] = useState<Task[] | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Task[];
    isBulk: boolean;
  } | null>(null);

  // Get column definitions
  const columns = React.useMemo(() => createTaskColumns(), []);

  // Filter visible columns
  const displayColumns = React.useMemo(() => columns.filter((col) => visibleColumns.has(col.id)), [columns, visibleColumns]);

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return items.map((item) => item.id);
  }, [items]);

  // Selection state
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  // Render sort indicator function (matching item table)
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

  // Calculate if a column should be sortable
  const isColumnSortable = (column: TaskColumn) => {
    return column.sortable !== false;
  };

  // Handle column sort
  const handleSort = (column: TaskColumn) => {
    if (isColumnSortable(column)) {
      const accessor = column.accessorKey || column.id;
      toggleSort(accessor);
    }
  };

  // Handle row selection
  const handleSelectItem = (itemId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(itemId, currentPageItemIds, event?.shiftKey || false);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, item: Task) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked item is part of selection
    const isItemSelected = isSelected(item.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      // Show bulk actions for all selected items
      const selectedItemsList = items.filter((i) => isSelected(i.id));
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

  const handleViewDetails = () => {
    if (contextMenu && contextMenu.items.length === 1) {
      navigate(routes.production.schedule.details(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (onEdit) {
        onEdit(contextMenu.items);
      } else {
        // Single edit
        navigate(routes.production.schedule.edit(contextMenu.items[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleStatusChange = async (newStatus: TASK_STATUS) => {
    if (!contextMenu) return;

    try {
      const tasks = contextMenu.items;
      const updates: any[] = [];

      for (const task of tasks) {
        // Validate status transition
        if (!isValidTaskStatusTransition(task.status as TASK_STATUS, newStatus)) {
          toast({
            title: "Transição inválida",
            description: `Não é possível mudar de ${getTaskStatusLabel(task.status as TASK_STATUS)} para ${getTaskStatusLabel(newStatus)}`,
            variant: "error",
          });
          continue;
        }

        const updateData: any = { status: newStatus };

        // Add required dates based on status
        if (newStatus === TASK_STATUS.IN_PRODUCTION && !task.startedAt) {
          updateData.startedAt = new Date();
        }
        if (newStatus === TASK_STATUS.COMPLETED && !task.finishedAt) {
          updateData.finishedAt = new Date();
        }

        updates.push({
          id: task.id,
          data: updateData,
        });
      }

      if (updates.length === 0) {
        setContextMenu(null);
        return;
      }

      if (updates.length === 1) {
        // Single update
        await update(updates[0]);
      } else {
        // Batch update
        await batchUpdate({ tasks: updates });
      }

      setContextMenu(null);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating task status:", error);
      }
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      setDeleteDialog({
        items: contextMenu.items,
        isBulk: contextMenu.isBulk && contextMenu.items.length > 1,
      });
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.isBulk && deleteDialog.items.length > 1) {
        // Bulk delete
        const ids = deleteDialog.items.map((item) => item.id);
        if (onDelete) {
          onDelete(deleteDialog.items);
        } else {
          await batchDelete({ taskIds: ids });
          // Remove deleted IDs from selection
          removeFromSelection(ids);
        }
      } else {
        // Single delete
        const deletedId = deleteDialog.items[0].id;
        if (onDelete) {
          onDelete(deleteDialog.items);
        } else {
          await deleteTask(deletedId);
          // Remove deleted ID from selection
          removeFromSelection([deletedId]);
        }
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting task(s):", error);
      }
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleDuplicate = () => {
    if (contextMenu && contextMenu.items.length === 1) {
      setDuplicateTask(contextMenu.items[0]);
      setContextMenu(null);
    }
  };

  const handleSetSector = () => {
    if (contextMenu) {
      setSetSectorTasks(contextMenu.items);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <TaskListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <p className="text-destructive">Erro ao carregar tarefas</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          <IconRefresh className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      <button
        onClick={() => {
          // Event handler placeholder
        }}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 9999,
          background: 'red',
          color: 'white',
          padding: '10px',
          border: 'none',
          borderRadius: '5px'
        }}
      >
        TEST CLICK
      </button>

      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column - only show if user has edit permissions */}
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onCheckedChange={() => toggleSelectAll(currentPageItemIds)}
                      aria-label="Select all items"
                      disabled={isLoading || items.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {displayColumns.map((column) => {
                const isSortable = isColumnSortable(column);

                return (
                  <TableHead
                    key={column.id}
                    className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.headerClassName)}
                    style={{ width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth }}
                  >
                    {isSortable ? (
                      <button
                        onClick={() => handleSort(column)}
                        className={cn(
                          "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                          column.className?.includes("text-center") && "justify-center",
                          column.className?.includes("text-right") && "justify-end",
                        )}
                        disabled={isLoading || items.length === 0}
                      >
                        <TruncatedTextWithTooltip text={column.header} />
                        {renderSortIndicator(column.accessorKey || column.id)}
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                          column.className?.includes("text-center") && "justify-center text-center",
                          column.className?.includes("text-right") && "justify-end text-right",
                          !column.className?.includes("text-") && "justify-start text-left",
                        )}
                      >
                        <TruncatedTextWithTooltip text={column.header} />
                      </div>
                    )}
                  </TableHead>
                );
              })}

              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconRefresh className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Erro ao carregar tarefas</div>
                    <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                      <IconRefresh className="h-4 w-4 mr-2" />
                      Tentar novamente
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconSelector className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const itemIsSelected = isSelected(item.id);
                const rowColorClass = getRowColorClass(item);

                return (
                  <tr
                    key={item.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Task-specific color overrides
                      rowColorClass,
                      // Selected state overrides all
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => {
                      // Don't navigate if clicking checkbox
                      if ((e.target as HTMLElement).closest("[data-checkbox]")) {
                        return;
                      }

                      navigate(routes.production.schedule.details(item.id));
                    }}
                    onMouseDown={() => {
                      // Mouse down handler
                    }}
                    onMouseUp={() => {
                      // Mouse up handler
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  >
                    {/* Selection checkbox - only show if user has edit permissions */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0 relative z-20")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => { e.stopPropagation(); handleSelectItem(item.id, e); }}>
                          <Checkbox checked={itemIsSelected} onCheckedChange={() => handleSelectItem(item.id)} aria-label={`Select ${item.name}`} data-checkbox />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {displayColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.cellClassName,
                          column.className,
                          "p-0 !border-r-0",
                          column.className?.includes("text-center") && "text-center",
                          column.className?.includes("text-right") && "text-right",
                          !column.className?.includes("text-") && "text-left",
                        )}
                        style={{
                          width: column.width,
                          minWidth: column.minWidth,
                          maxWidth: column.maxWidth,
                        }}
                      >
                        <div
                          className="px-4 py-2"
                          onClick={(e) => {
                            // Cell click handler
                          }}
                        >
                          {column.formatter
                            ? column.formatter(column.accessorFn ? column.accessorFn(item) : (item as any)[column.accessorKey || column.id], item)
                            : column.accessorFn
                              ? column.accessorFn(item)
                              : (item as any)[column.accessorKey || column.id]}
                        </div>
                      </TableCell>
                    ))}
                  </tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={page}
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

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <DropdownMenuTrigger asChild>
          <div className="hidden" />
        </DropdownMenuTrigger>
        <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56 ![position:fixed]"
        onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.items.length} tarefas selecionadas</div>}

          {!contextMenu?.isBulk && (
            <>
              <DropdownMenuItem onClick={handleViewDetails}>
                <IconEye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={handleDuplicate}>
                  <IconCopy className="h-4 w-4 mr-2" />
                  Criar Cópias
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {canEdit && (
            <>
              <DropdownMenuItem onClick={handleEdit}>
                <IconEdit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleSetSector}>
                <IconBuildingFactory2 className="h-4 w-4 mr-2" />
                Definir Setor
              </DropdownMenuItem>
            </>
          )}

          {canEdit && (
            <>
              <DropdownMenuSeparator />

              {/* Status change actions */}
              {contextMenu?.items.some((task) => task.status === TASK_STATUS.PENDING) && (
                <DropdownMenuItem onClick={() => handleStatusChange(TASK_STATUS.IN_PRODUCTION)}>
                  <IconPlayerPlay className="h-4 w-4 mr-2" />
                  Iniciar produção
                </DropdownMenuItem>
              )}

              {contextMenu?.items.some((task) => task.status === TASK_STATUS.IN_PRODUCTION) && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusChange(TASK_STATUS.COMPLETED)}>
                    <IconCheck className="h-4 w-4 mr-2" />
                    Finalizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(TASK_STATUS.ON_HOLD)}>
                    <IconPlayerPause className="h-4 w-4 mr-2" />
                    Colocar em espera
                  </DropdownMenuItem>
                </>
              )}

              {contextMenu?.items.some((task) => task.status === TASK_STATUS.ON_HOLD) && (
                <DropdownMenuItem onClick={() => handleStatusChange(TASK_STATUS.IN_PRODUCTION)}>
                  <IconPlayerPlay className="h-4 w-4 mr-2" />
                  Retomar produção
                </DropdownMenuItem>
              )}

              {contextMenu?.items.some((task) => task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED) && (
                <DropdownMenuItem onClick={() => handleStatusChange(TASK_STATUS.CANCELLED)}>
                  <IconX className="h-4 w-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              )}
            </>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="h-4 w-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Duplicate Modal */}
      <TaskDuplicateModal
        task={duplicateTask}
        open={!!duplicateTask}
        onOpenChange={(open) => !open && setDuplicateTask(null)}
        onSuccess={() => {
          // The list will automatically refresh due to React Query invalidation
          setDuplicateTask(null);
        }}
      />

      {/* Set Sector Modal */}
      <TaskSetSectorModal
        tasks={setSectorTasks || []}
        open={!!setSectorTasks}
        onOpenChange={(open) => !open && setSetSectorTasks(null)}
        onSuccess={() => {
          // The list will automatically refresh due to React Query invalidation
          setSetSectorTasks(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {deleteDialog?.items.length} tarefa{deleteDialog?.items.length !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
