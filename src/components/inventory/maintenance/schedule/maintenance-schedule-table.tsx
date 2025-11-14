import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MaintenanceSchedule } from "../../../../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconChevronUp,
  IconChevronDown,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconSelector,
  IconAlertTriangle,
  IconCalendar,
  IconPlayerPlay,
  IconPlayerPause,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMaintenanceSchedules, useMaintenanceScheduleMutations } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { MaintenanceScheduleGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { createMaintenanceScheduleColumns } from "./maintenance-schedule-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { routes } from "../../../../constants";

interface MaintenanceScheduleTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (schedules: MaintenanceSchedule[]) => void;
  onActivate?: (schedules: MaintenanceSchedule[]) => void;
  onDeactivate?: (schedules: MaintenanceSchedule[]) => void;
  onDelete?: (schedules: MaintenanceSchedule[]) => void;
  filters?: Partial<MaintenanceScheduleGetManyFormData>;
  onDataChange?: (data: { items: MaintenanceSchedule[]; totalRecords: number }) => void;
}

export function MaintenanceScheduleTable({
  visibleColumns,
  className,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  filters = {},
  onDataChange,
}: MaintenanceScheduleTableProps) {
  const navigate = useNavigate();
  const { updateMutation } = useMaintenanceScheduleMutations();

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
    removeFromSelection: _removeFromSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [
      { column: "isActive", direction: "desc" },
      { column: "nextRun", direction: "asc" },
    ],
  });

  // Prepare query parameters
  const queryFilters: Partial<MaintenanceScheduleGetManyFormData> = {
    // When showSelectedOnly is true, don't apply filters
    ...(showSelectedOnly ? {} : filters),
    page: page + 1, // Convert 0-based to 1-based for API
    limit: pageSize,
    orderBy: convertSortConfigsToOrderBy(sortConfigs),
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
  };

  // Filter to show only selected items if enabled
  if (showSelectedOnly && selectedIds.length > 0) {
    queryFilters.where = {
      id: { in: selectedIds },
    };
  }

  // Fetch data
  const { data, isLoading, error } = useMaintenanceSchedules(queryFilters);

  // Update parent component with current data
  React.useEffect(() => {
    if (data?.data && onDataChange) {
      onDataChange({
        items: data.data,
        totalRecords: data.meta?.totalRecords || 0,
      });
    }
  }, [data, onDataChange]);

  const schedules = data?.data || [];
  const totalPages = data?.meta ? Math.ceil(data.meta.totalRecords / pageSize) : 1;
  const totalRecords = data?.meta?.totalRecords || 0;

  // Get visible columns based on selection
  const columns = createMaintenanceScheduleColumns();
  const visibleColumnConfigs = columns.filter((col) => visibleColumns.has(col.key));

  // Row actions
  const handleRowClick = (schedule: MaintenanceSchedule) => {
    navigate(routes.inventory.maintenance.schedules.details(schedule.id));
  };

  // Get current page schedule IDs for selection
  const currentPageScheduleIds = React.useMemo(() => {
    return schedules.map((schedule) => schedule.id);
  }, [schedules]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageScheduleIds);
  const partiallySelected = isPartiallySelected(currentPageScheduleIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageScheduleIds);
  };

  const handleSelectSchedule = (scheduleId: string) => {
    toggleSelection(scheduleId);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    schedules: MaintenanceSchedule[];
    isBulk: boolean;
  } | null>(null);

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, schedule: MaintenanceSchedule) => {
    e.preventDefault();
    e.stopPropagation();

    const isScheduleSelected = isSelected(schedule.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isScheduleSelected) {
      const selectedSchedulesList = schedules.filter((s) => isSelected(s.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        schedules: selectedSchedulesList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        schedules: [schedule],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu && onEdit) {
      onEdit(contextMenu.schedules);
      setContextMenu(null);
    }
  };

  const handleActivate = async () => {
    if (!contextMenu || !onActivate) return;

    const schedulesToActivate = contextMenu.schedules.filter((s) => !s.isActive);
    if (schedulesToActivate.length === 0) {
      setContextMenu(null);
      return;
    }

    try {
      await Promise.all(
        schedulesToActivate.map((schedule) =>
          updateMutation.mutateAsync({
            id: schedule.id,
            data: { isActive: true },
          })
        )
      );
    } catch (error) {
      console.error("Error activating schedules:", error);
    }

    setContextMenu(null);
  };

  const handleDeactivate = async () => {
    if (!contextMenu || !onDeactivate) return;

    const schedulesToDeactivate = contextMenu.schedules.filter((s) => s.isActive);
    if (schedulesToDeactivate.length === 0) {
      setContextMenu(null);
      return;
    }

    try {
      await Promise.all(
        schedulesToDeactivate.map((schedule) =>
          updateMutation.mutateAsync({
            id: schedule.id,
            data: { isActive: false },
          })
        )
      );
    } catch (error) {
      console.error("Error deactivating schedules:", error);
    }

    setContextMenu(null);
  };

  const handleDelete = async () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.schedules);
      setContextMenu(null);
    }
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
                    data-checkbox
                  />
                </div>
              </TableHead>

              {/* Data columns */}
              {visibleColumnConfigs.map((column) => (
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
                        column.align === "left" && "justify-start",
                        !column.align && "justify-start"
                      )}
                      disabled={isLoading || schedules.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      <div className="inline-flex items-center ml-1">
                        {getSortDirection(column.key) === null && (
                          <IconSelector className="h-4 w-4 text-muted-foreground" />
                        )}
                        {getSortDirection(column.key) === "asc" && (
                          <IconChevronUp className="h-4 w-4 text-foreground" />
                        )}
                        {getSortDirection(column.key) === "desc" && (
                          <IconChevronDown className="h-4 w-4 text-foreground" />
                        )}
                        {getSortOrder(column.key) !== null && sortConfigs.length > 1 && (
                          <span className="text-xs ml-0.5">{getSortOrder(column.key)! + 1}</span>
                        )}
                      </div>
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
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">
                      Não foi possível carregar os agendamentos
                    </div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconCalendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum agendamento encontrado</div>
                    {filters && Object.keys(filters).length > 1 && (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule, index) => {
                const scheduleIsSelected = isSelected(schedule.id);

                return (
                  <TableRow
                    key={schedule.id}
                    data-state={scheduleIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      scheduleIsSelected && "bg-muted/30 hover:bg-muted/40"
                    )}
                    onClick={() => handleRowClick(schedule)}
                    onContextMenu={(e) => handleContextMenu(e, schedule)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={scheduleIsSelected}
                          onCheckedChange={() => handleSelectSchedule(schedule.id)}
                          aria-label={`Select schedule`}
                          data-checkbox
                        />
                      </div>
                    </TableCell>

                    {/* Data columns */}
                    {visibleColumnConfigs.map((column) => (
                      <TableCell key={column.key} className={cn(column.className, "p-0 !border-r-0")}>
                        <div
                          className={cn(
                            "px-4 py-2",
                            column.align === "center" && "flex justify-center",
                            column.align === "right" && "text-right flex justify-end",
                            column.align === "left" && "text-left",
                            !column.align && "text-left"
                          )}
                        >
                          {column.accessor(schedule)}
                        </div>
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
              {contextMenu.schedules.length} agendamentos selecionados
            </div>
          )}

          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.schedules.length > 1 ? "Editar em lote" : "Editar"}
          </DropdownMenuItem>

          {/* Show activate option for inactive schedules */}
          {contextMenu?.schedules.some((s) => !s.isActive) && (
            <DropdownMenuItem onClick={handleActivate}>
              <IconPlayerPlay className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.schedules.length > 1
                ? "Ativar agendamentos"
                : "Ativar agendamento"}
            </DropdownMenuItem>
          )}

          {/* Show deactivate option for active schedules */}
          {contextMenu?.schedules.some((s) => s.isActive) && (
            <DropdownMenuItem onClick={handleDeactivate}>
              <IconPlayerPause className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.schedules.length > 1
                ? "Desativar agendamentos"
                : "Desativar agendamento"}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.schedules.length > 1
              ? "Deletar selecionados"
              : "Deletar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
