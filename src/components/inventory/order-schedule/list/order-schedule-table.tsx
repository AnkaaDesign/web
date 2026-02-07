import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
  IconEdit,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconPlayerPlay,
  IconPlayerPause,
  IconCalendarRepeat,
} from "@tabler/icons-react";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useAuth } from "../../../../hooks/use-auth";
import { canEditOrders, canDeleteOrders, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { useOrderSchedules, useOrderScheduleMutations } from "../../../../hooks";
import type { OrderScheduleGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import type { OrderSchedule } from "../../../../types";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { createOrderScheduleColumns, type OrderScheduleColumn } from "./order-schedule-table-columns";

interface OrderScheduleTableProps {
  visibleColumns: Set<string>;
  className?: string;
  filters?: Partial<OrderScheduleGetManyFormData>;
  onDataChange?: (data: { schedules: OrderSchedule[]; totalRecords: number }) => void;
  onActivate?: (schedules: OrderSchedule[]) => void;
  onDeactivate?: (schedules: OrderSchedule[]) => void;
  onDelete?: (schedules: OrderSchedule[]) => void;
}

export function OrderScheduleTable({
  visibleColumns,
  className,
  filters = {},
  onDataChange,
  onActivate,
  onDeactivate,
  onDelete,
}: OrderScheduleTableProps) {
  const navigate = useNavigate();

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: OrderSchedule[];
    isBulk: boolean;
  } | null>(null);

  // Permission checks
  const { user } = useAuth();
  const canEdit = user ? canEditOrders(user) : false;
  const canDeleteSchedule = user ? canDeleteOrders(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, "order") : false;

  // Mutations
  const { delete: deleteSchedule, update: updateSchedule } = useOrderScheduleMutations();

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
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
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize query parameters
  const queryParams = useMemo(
    () => ({
      ...filters,
      page: page + 1,
      limit: pageSize,
      orderBy: convertSortConfigsToOrderBy(
        sortConfigs.length > 0 ? sortConfigs : [{ column: "createdAt", direction: "desc" }]
      ),
    }),
    [filters, page, pageSize, sortConfigs]
  );

  // Fetch data
  const { data, isLoading, error } = useOrderSchedules(queryParams);

  const schedules = data?.data || [];
  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");

  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = schedules.length > 0 ? `${totalRecords}-${schedules.map((s) => s.id).join(",")}` : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ schedules, totalRecords });
      }
    }
  }, [schedules, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: OrderSchedule[];
    isBulk: boolean;
  } | null>(null);

  // Column definitions - use centralized columns from order-schedule-table-columns
  const allColumns: OrderScheduleColumn[] = useMemo(() => createOrderScheduleColumns(), []);

  // Filter columns based on visibility
  const columns = useMemo(() => {
    return allColumns.filter((col) => visibleColumns.has(col.key));
  }, [allColumns, visibleColumns]);

  // Get current page item IDs for selection
  const currentPageItemIds = useMemo(() => {
    return schedules.map((schedule) => schedule.id);
  }, [schedules]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageItemIds);
  };

  const handleSelectItem = (itemId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(itemId, currentPageItemIds, event?.shiftKey || false);
  };

  // Render sort indicator
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

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, schedule: OrderSchedule) => {
    e.preventDefault();
    e.stopPropagation();

    const isItemSelected = isSelected(schedule.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      const selectedItemsList = schedules.filter((s) => isSelected(s.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItemsList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [schedule],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      navigate(routes.inventory.orders.schedules.edit(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleActivate = async () => {
    if (contextMenu) {
      if (onActivate) {
        onActivate(contextMenu.items);
      } else {
        for (const schedule of contextMenu.items) {
          await updateSchedule({ id: schedule.id, isActive: true });
        }
      }
      setContextMenu(null);
    }
  };

  const handleDeactivate = async () => {
    if (contextMenu) {
      if (onDeactivate) {
        onDeactivate(contextMenu.items);
      } else {
        for (const schedule of contextMenu.items) {
          await updateSchedule({ id: schedule.id, isActive: false });
        }
      }
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      setDeleteDialog({ items: contextMenu.items, isBulk: contextMenu.isBulk });
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    for (const schedule of deleteDialog.items) {
      await deleteSchedule(schedule.id);
    }
    setDeleteDialog(null);
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              {showInteractive && (
                <TableHead
                  className={cn(
                    TABLE_LAYOUT.checkbox.className,
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0"
                  )}
                >
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all schedules"
                      disabled={isLoading || schedules.length === 0}
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0",
                    column.className
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start"
                      )}
                      disabled={isLoading || schedules.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" && "justify-center text-center",
                        column.align === "right" && "justify-end text-right",
                        !column.align && "justify-start text-left"
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Scrollbar spacer */}
              {!isOverlay && (
                <TableHead
                  style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }}
                  className="bg-muted p-0 border-0 !border-r-0 shrink-0"
                ></TableHead>
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
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconCalendarRepeat className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os agendamentos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconCalendarRepeat className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum agendamento encontrado</div>
                    <div className="text-sm">Crie um agendamento para automatizar seus pedidos.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule, index) => {
                const itemIsSelected = isSelected(schedule.id);

                return (
                  <TableRow
                    key={schedule.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40"
                    )}
                    onClick={() => navigate(routes.inventory.orders.schedules.details(schedule.id))}
                    onContextMenu={(e) => handleContextMenu(e, schedule)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectItem(schedule.id, e);
                          }}
                        >
                          <Checkbox checked={itemIsSelected} aria-label={`Select ${schedule.name || schedule.id}`} />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.align === "left" && "text-left",
                          !column.align && "text-left"
                        )}
                      >
                        <div className="px-4 py-2">{column.accessor(schedule)}</div>
                      </TableCell>
                    ))}
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
        <DropdownMenuContent
          style={{
            position: "fixed",
            left: contextMenu?.x,
            top: contextMenu?.y,
          }}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {contextMenu.items.length} agendamentos selecionados
            </div>
          )}

          {canEdit && !contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.items.some((s) => !s.isActive) && (
            <DropdownMenuItem onClick={handleActivate} className="text-green-700">
              <IconPlayerPlay className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Ativar selecionados" : "Ativar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.items.some((s) => s.isActive) && (
            <DropdownMenuItem onClick={handleDeactivate} className="text-orange-600">
              <IconPlayerPause className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Desativar selecionados" : "Desativar"}
            </DropdownMenuItem>
          )}

          {canDeleteSchedule && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Deletar selecionados" : "Deletar"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} agendamentos? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja deletar este agendamento? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
