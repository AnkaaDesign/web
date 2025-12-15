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
import { TASK_STATUS, routes } from "../../../../constants";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
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
  navigationRoute?: 'history' | 'onHold' | 'schedule';
}

export function TaskHistoryTable({
  visibleColumns,
  className,
  filters = {},
  onDataChange,
  navigationRoute = 'history',
}: TaskHistoryTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditTasks(user);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const tableState = useTableState({
    defaultPageSize: 40,
    defaultSort: [{ column: "finishedAt", direction: "desc" }],
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

  // Log table state
  React.useEffect(() => {
    console.log("[TaskHistoryTable] Table state updated:", {
      page,
      pageSize,
      selectedIds: selectedIds.length,
      sortConfigs,
      showSelectedOnly,
      currentURL: window.location.search
    });
  }, [page, pageSize, selectedIds, sortConfigs, showSelectedOnly]);

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      customer: true,
      sector: true,
      services: {
        include: {
          service: true,
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
    console.log("[TaskHistoryTable] Building query params:", {
      filters,
      filtersSearchingFor: filters.searchingFor,
      page,
      pageSize,
      showSelectedOnly,
      selectedIdsCount: selectedIds.length,
      sortConfigs
    });

    // Determine status to use
    const statusToUse = (!filters.status || (Array.isArray(filters.status) && filters.status.length === 0))
      ? [TASK_STATUS.COMPLETED]
      : filters.status;

    const params = {
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : { ...filters, status: statusToUse }),
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
    };

    console.log("[TaskHistoryTable] Query params built:", {
      searchingFor: params.searchingFor,
      page: params.page,
      limit: params.limit,
      status: params.status,
      hasOrderBy: !!params.orderBy,
      hasWhere: !!params.where,
      hasFinishedDateRange: !!params.finishedDateRange,
      finishedDateRange: params.finishedDateRange,
      allParamKeys: Object.keys(params),
    });

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch data
  const { data: response, isLoading, error } = useTasks(queryParams);

  const tasks = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Log response data
  React.useEffect(() => {
    console.log("[TaskHistoryTable] Data response:", {
      isLoading,
      error: error?.message,
      tasksCount: tasks.length,
      totalRecords,
      totalPages,
      currentPage: page,
      metaPage: response?.meta?.page,
      hasNextPage: response?.meta?.hasNextPage,
      firstTaskName: tasks[0]?.name,
      lastTaskName: tasks[tasks.length - 1]?.name
    });
  }, [isLoading, error, tasks, totalRecords, totalPages, page, response]);


  // Define all available columns
  const allColumns = React.useMemo(() => createTaskHistoryColumns(), []);

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

  // Log context menu state changes
  React.useEffect(() => {
    console.log('[TaskHistoryTable] Context menu state changed:', contextMenu ? {
      x: contextMenu.x,
      y: contextMenu.y,
      tasksCount: contextMenu.tasks.length,
      isBulk: contextMenu.isBulk
    } : null);
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
        console.log('[TaskHistoryTable] Click inside menu/modal, not closing context menu');
        return;
      }
      console.log('[TaskHistoryTable] Click outside, closing context menu');
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

                return (
                  <TableRow
                    key={task.id}
                    data-state={taskIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      taskIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => {
                      // Don't navigate if clicking checkbox
                      if ((e.target as HTMLElement).closest("[data-checkbox]")) {
                        return;
                      }

                      const detailRoute =
                        navigationRoute === 'onHold' ? routes.production.scheduleOnHold.details(task.id) :
                        navigationRoute === 'schedule' ? routes.production.schedule.details(task.id) :
                        routes.production.history.details(task.id);

                      console.log('Task history row clicked, navigating to:', detailRoute);
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
          onPageChange={(newPage) => {
            console.log("[TaskHistoryTable] Page change requested:", {
              from: page,
              to: newPage,
              totalPages,
              totalRecords,
              currentURL: window.location.search
            });
            setPage(newPage);
          }}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={(newPageSize) => {
            console.log("[TaskHistoryTable] Page size change:", {
              from: pageSize,
              to: newPageSize
            });
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
        />
      )}
    </div>
  );
}
