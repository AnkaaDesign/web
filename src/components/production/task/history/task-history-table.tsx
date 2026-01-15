import React, { useState } from "react";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { useTasks } from "../../../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { canEditTasks } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TaskHistoryContextMenu } from "./task-history-context-menu";
import { createTaskHistoryColumns } from "./task-history-columns";
import { cn } from "@/lib/utils";
import { TASK_STATUS, routes, SERVICE_ORDER_STATUS } from "../../../../constants";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { isDateInPast, getHoursBetween } from "../../../../utils";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconChevronUp, IconChevronDown, IconSelector, IconAlertTriangle, IconHistory } from "@tabler/icons-react";
import { TaskHistoryTableSkeleton } from "./task-history-table-skeleton";
import { useNavigate } from "react-router-dom";

interface TaskHistoryTableProps {
  visibleColumns: Set<string>;
  className?: string;
  filters?: Partial<TaskGetManyFormData>;
  onDataChange?: (data: { items: Task[]; totalRecords: number }) => void;
  navigationRoute?: 'history' | 'preparation' | 'schedule';
  advancedActionsRef?: React.RefObject<{ openModal: (type: string, taskIds: string[]) => void } | null>;
  onStartCopyFromTask?: (targetTasks: Task[]) => void;
  isSelectingSourceTask?: boolean;
  onSourceTaskSelect?: (task: Task) => void;
}

/**
 * Get the appropriate color class for the commercial service order cell based on:
 * 1. Task's forecastDate proximity (must be within 7 days)
 * 2. Having at least one incomplete commercial service order
 *
 * For agenda (preparation) route only:
 * - Neutral: No forecastDate, > 7 days away, or no incomplete commercial service orders
 * - Yellow/Amber: forecastDate is 3-7 days away AND has incomplete commercial service order
 * - Red: forecastDate is ≤ 3 days away (or overdue) AND has incomplete commercial service order
 */
function getCommercialServiceOrderCellColorClass(task: Task, navigationRoute?: string): string {
  // Only apply color logic to preparation (agenda) route
  if (navigationRoute !== 'preparation') {
    return "";
  }

  // Tasks without forecastDate - neutral
  if (!task.forecastDate) {
    return "";
  }

  // Check if task has at least one incomplete commercial service order
  const commercialServiceOrders = task.services?.filter(
    (so) => so.type === 'COMMERCIAL'
  ) || [];

  // No commercial service orders - no coloring
  if (commercialServiceOrders.length === 0) {
    return "";
  }

  // Check if there's at least one incomplete (not COMPLETED or CANCELLED) commercial service order
  const hasIncompleteCommercial = commercialServiceOrders.some(
    (so) => so.status !== SERVICE_ORDER_STATUS.COMPLETED && so.status !== SERVICE_ORDER_STATUS.CANCELLED
  );

  // All commercial service orders are completed - no coloring
  if (!hasIncompleteCommercial) {
    return "";
  }

  // Calculate days remaining until forecastDate
  const now = new Date();
  const forecast = new Date(task.forecastDate);
  const diffMs = forecast.getTime() - now.getTime();
  const daysRemaining = diffMs / (1000 * 60 * 60 * 24);

  // Red zone: 3 days or less (including overdue) AND has incomplete commercial service order
  if (daysRemaining <= 3) {
    return "bg-red-200 dark:bg-red-800";
  }

  // Yellow zone: between 3 and 7 days AND has incomplete commercial service order
  if (daysRemaining <= 7) {
    return "bg-amber-200 dark:bg-amber-700";
  }

  // Safe zone: more than 7 days - neutral (no special color)
  return "";
}

export function TaskHistoryTable({
  visibleColumns,
  className,
  filters = {},
  onDataChange,
  navigationRoute = 'history',
  advancedActionsRef,
  onStartCopyFromTask,
  isSelectingSourceTask,
  onSourceTaskSelect,
}: TaskHistoryTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditTasks(user);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const tableState = useTableState({
    defaultPageSize: 40,
    defaultSort: [{
      column: navigationRoute === 'preparation' ? 'forecastDate' : 'finishedAt',
      direction: navigationRoute === 'preparation' ? 'asc' : 'desc'
    }],
    resetSelectionOnPageChange: false,
  });

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
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = tableState;


  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      customer: true,
      sector: true,
      services: {
        include: {
          service: true,
          assignedTo: true,
        },
      },
      observation: true,
      generalPainting: {
        include: {
          paintType: true,
          paintBrand: true,
        },
      },
      createdBy: true,
      updatedBy: true,
      truck: {
        include: {
          backSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          leftSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          rightSideLayout: {
            include: {
              layoutSections: true,
            },
          },
        },
      },
      // Note: commission is a direct field on Task, not a relation, so it's always included
    }),
    [],
  );

  // Build query parameters
  const queryParams = React.useMemo(() => {
    // Determine status to use
    // Don't default to COMPLETED if shouldDisplayInAgenda is set (agenda has its own filtering logic)
    const hasAgendaFilter = filters.shouldDisplayInAgenda === true;
    const statusToUse = hasAgendaFilter
      ? undefined // Let shouldDisplayInAgenda handle the filtering
      : (!filters.status || (Array.isArray(filters.status) && filters.status.length === 0))
        ? [TASK_STATUS.COMPLETED]
        : filters.status;

    const params = {
      // Always apply base filters to prevent showing unintended tasks
      ...filters,
      ...(statusToUse && { status: statusToUse }),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, add ID filter to restrict to selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch data
  const { data: response, isLoading, error } = useTasks(queryParams);

  const tasks = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;



  // Define all available columns
  const allColumns = React.useMemo(() => createTaskHistoryColumns({
    currentUserId: user?.id,
    navigationRoute
  }), [user?.id, navigationRoute]);

  // Filter visible columns
  const columns = React.useMemo(
    () => allColumns.filter((col) => visibleColumns.has(col.id)),
    [allColumns, visibleColumns],
  );

  // Notify parent of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = tasks.length > 0 ? `${totalRecords}-${tasks.map((task) => task.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: tasks, totalRecords });
      }
    }
  }, [tasks, totalRecords, onDataChange]);

  // Check selection state for current page
  const currentPageIds = tasks.map((task) => task.id);
  const allSelected = isAllSelected(currentPageIds);
  const partiallySelected = isPartiallySelected(currentPageIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageIds);
  };

  const handleSelectItem = (id: string, event?: React.MouseEvent) => {
    handleRowClickSelection(id, currentPageIds, event?.shiftKey || false);
  };

  const handleContextMenuClose = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  const renderSortIndicator = (columnKey: string) => {
    const currentSort = sortConfigs.find(s => s.column === columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {!currentSort && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {currentSort?.direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {currentSort?.direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {currentSort && sortConfigs.length > 1 && (
          <span className="text-xs ml-0.5">{sortConfigs.findIndex(s => s.column === columnKey) + 1}</span>
        )}
      </div>
    );
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tasks: Task[];
    isBulk: boolean;
  } | null>(null);

  // Context menu state changed
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryTable] Context menu state changed:', contextMenu ? {
        x: contextMenu.x,
        y: contextMenu.y,
        tasksCount: contextMenu.tasks.length,
        isBulk: contextMenu.isBulk
      } : null);
    }
  }, [contextMenu]);

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked task is part of selection
    const isTaskSelected = isSelected(task.id);
    const hasSelection = selectedIds.length > 0;

    if (hasSelection && isTaskSelected) {
      // Show bulk actions for all selected tasks
      const selectedTasksList = tasks.filter((t) => isSelected(t.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        tasks: selectedTasksList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked task
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        tasks: [task],
        isBulk: false,
      });
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside a dropdown menu or dialog/modal
      const target = e.target as HTMLElement;
      if (
        target.closest('[role="menu"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-radix-popper-content-wrapper]')
      ) {
        return;
      }
      setContextMenu(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <TaskHistoryTableSkeleton />;
  }


  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column - only show for users who can edit */}
              {canEdit && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all tasks"
                      disabled={isLoading || tasks.length === 0}
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead key={column.id} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                      )}
                      disabled={isLoading || tasks.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.id)}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

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
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar o histórico de tarefas</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconHistory className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <div className="text-sm">Nenhuma tarefa finalizada foi encontrada.</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task, index) => {
                const taskIsSelected = isSelected(task.id);

                // Check if task has NO service orders (only for agenda)
                const hasNoServiceOrders = !task.services || task.services.length === 0;
                const shouldShowRedBorder = navigationRoute === 'preparation' && hasNoServiceOrders;

                // Get cell color for commercial service order column based on deadline and incomplete status
                const commercialCellColorClass = getCommercialServiceOrderCellColorClass(task, navigationRoute);

                return (
                  <tr
                    key={task.id}
                    data-state={taskIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      taskIsSelected && "bg-muted/30 hover:bg-muted/40",
                      // Source selection mode highlight
                      isSelectingSourceTask && "hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary",
                      // Red border for tasks with NO service orders (agenda only)
                      shouldShowRedBorder && "border-l-4 border-l-red-500",
                    )}
                    onClick={(e) => {
                      // Don't navigate if clicking checkbox
                      if ((e.target as HTMLElement).closest("[data-checkbox]")) {
                        return;
                      }

                      // Handle source task selection mode
                      if (isSelectingSourceTask && onSourceTaskSelect) {
                        onSourceTaskSelect(task);
                        return;
                      }

                      const detailRoute =
                        navigationRoute === 'preparation' ? routes.production.preparation.details(task.id) :
                        navigationRoute === 'schedule' ? routes.production.schedule.details(task.id) :
                        routes.production.history.details(task.id);

                      if (process.env.NODE_ENV !== 'production') {
                        console.log('Task history row clicked, navigating to:', detailRoute);
                      }
                      navigate(detailRoute);
                    }}
                    onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                  >
                    {/* Selection checkbox - only show for users who can edit */}
                    {canEdit && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => { e.stopPropagation(); handleSelectItem(task.id, e); }}>
                          <Checkbox checked={taskIsSelected} onCheckedChange={() => handleSelectItem(task.id)} aria-label={`Select ${task.name}`} data-checkbox />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          // Apply cell-level coloring only to commercial service order column
                          // Colors indicate deadline proximity + incomplete commercial service orders
                          column.id === "serviceOrders.commercial" && commercialCellColorClass,
                        )}
                      >
                        <div className="px-4 py-2">
                          {column.formatter
                            ? column.formatter(
                                column.accessorFn
                                  ? column.accessorFn(task)
                                  : task[column.accessorKey as keyof Task],
                                task,
                              )
                            : column.accessorFn
                            ? column.accessorFn(task)
                            : task[column.accessorKey as keyof Task]}
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
          onPageChange={(newPage) => {
            setPage(newPage);
          }}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
          }}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <TaskHistoryContextMenu
          tasks={contextMenu.tasks}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleContextMenuClose}
          selectedIds={contextMenu.isBulk ? selectedIds : [contextMenu.tasks[0]?.id].filter(Boolean)}
          navigationRoute={navigationRoute}
          advancedActionsRef={advancedActionsRef}
          onStartCopyFromTask={onStartCopyFromTask}
        />
      )}
    </div>
  );
}
