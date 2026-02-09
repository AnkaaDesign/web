import React, { useState, useCallback, useEffect } from "react";
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
import { TASK_STATUS, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { hasPrivilege } from "../../../../utils/user";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { isDateInPast, getHoursBetween } from "../../../../utils";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { IconAlertTriangle, IconHistory } from "@tabler/icons-react";
import { TaskHistoryTableSkeleton } from "./task-history-table-skeleton";
import { useNavigate } from "react-router-dom";
import { ColumnHeader } from "@/components/ui/column-header";
import { useColumnWidths, DEFAULT_COLUMN_WIDTHS, COLUMN_WIDTH_CONSTRAINTS } from "@/hooks/common/use-column-widths";

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
  /** Handler for shift+click selection across tables */
  onShiftClickSelect?: (taskId: string) => void;
  /** Handler to update last clicked task for cross-table shift+click */
  onSingleClickSelect?: (taskId: string) => void;
  /** External expanded groups state */
  externalExpandedGroups?: Set<string>;
  /** Handler to update expanded groups state */
  onExpandedGroupsChange?: (expandedGroups: Set<string>) => void;
  /** Callback to report group IDs to parent */
  onGroupsDetected?: (groupIds: string[], hasGroups: boolean) => void;
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
  onShiftClickSelect,
  onSingleClickSelect,
  externalExpandedGroups: _externalExpandedGroups,
  onExpandedGroupsChange: _onExpandedGroupsChange,
  onGroupsDetected,
}: TaskHistoryTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditTasks(user);

  // Get user's sector privilege for column visibility
  const userSectorPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Check if user can view price (Admin or Financial only)
  const canViewPrice = user && (
    hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(user, SECTOR_PRIVILEGES.FINANCIAL)
  );


  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Column widths management for resizable columns
  const storageKey = `task-history-column-widths-${navigationRoute}`;
  const { getColumnWidth, setColumnWidth } = useColumnWidths({
    storageKey,
    defaultWidths: DEFAULT_COLUMN_WIDTHS,
  });

  // Use URL state management for pagination and selection
  const tableState = useTableState({
    defaultPageSize: 40,
    defaultSort: navigationRoute === 'preparation'
      ? [
          { column: 'forecastDate', direction: 'asc' },
          { column: 'name', direction: 'asc' },
          { column: 'identificador', direction: 'asc' },
        ]
      : [{ column: 'finishedAt', direction: 'desc' }],
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
    setSelectedIds: _setSelectedIds,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount: _selectionCount,
    resetSelection: _resetSelection,
    removeFromSelection: _removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = tableState;


  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      customer: {
        select: {
          id: true,
          fantasyName: true,
          corporateName: true,
        },
      },
      sector: {
        select: {
          id: true,
          name: true,
        },
      },
      serviceOrders: {
        select: {
          id: true,
          name: true,
          status: true,
          type: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      observation: {
        select: {
          id: true,
          description: true,
        },
      },
      generalPainting: {
        select: {
          id: true,
          name: true,
          hex: true,
          finish: true,
          paintType: {
            select: {
              id: true,
              name: true,
            },
          },
          paintBrand: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      truck: {
        select: {
          id: true,
          plate: true,
          chassisNumber: true,
          // Don't load layouts for history list view - not displayed
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

  // History table does not use grouping - notify parent that there are no groups
  useEffect(() => {
    if (onGroupsDetected) {
      onGroupsDetected([], false);
    }
  }, [onGroupsDetected]);


  // Define all available columns
  const allColumns = React.useMemo(() => createTaskHistoryColumns({
    canViewPrice: !!canViewPrice,
    currentUserId: user?.id,
    sectorPrivilege: userSectorPrivilege,
    navigationRoute
  }), [canViewPrice, user?.id, userSectorPrivilege, navigationRoute]);

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

  // const _renderSortIndicator = (columnKey: string) => {
  //   const currentSort = sortConfigs.find(s => s.column === columnKey);

  //   return (
  //     <div className="inline-flex items-center ml-1">
  //       {!currentSort && <IconSelector className="h-4 w-4 text-muted-foreground" />}
  //       {currentSort?.direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
  //       {currentSort?.direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
  //       {currentSort && sortConfigs.length > 1 && (
  //         <span className="text-xs ml-0.5">{sortConfigs.findIndex(s => s.column === columnKey) + 1}</span>
  //       )}
  //     </div>
  //   );
  // };

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

  // Helper function to handle task row clicks
  const handleTaskRowClick = useCallback((e: React.MouseEvent, task: Task) => {
    // Don't navigate if clicking checkbox or if it's a context menu click
    if ((e.target as HTMLElement).closest("[data-checkbox]") || e.button === 2) {
      return;
    }

    // Handle source task selection mode
    if (isSelectingSourceTask && onSourceTaskSelect) {
      onSourceTaskSelect(task);
      return;
    }

    // Handle selection with Ctrl/Cmd or Shift
    if (e.ctrlKey || e.metaKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TaskHistoryTable] Ctrl/Cmd click - toggling selection');
      }
      toggleSelection(task.id);
      // Update last clicked task for cross-table shift+click
      onSingleClickSelect?.(task.id);
    } else if (e.shiftKey) {
      // Shift+click - use cross-table selection if available
      if (onShiftClickSelect) {
        onShiftClickSelect(task.id);
      } else {
        // Fallback: Implement shift-click range selection within this table only
        handleSelectItem(task.id, e);
      }
    } else {
      // Normal click - navigate
      const detailRoute =
        navigationRoute === 'preparation' ? routes.production.preparation.details(task.id) :
        navigationRoute === 'schedule' ? routes.production.schedule.details(task.id) :
        routes.production.history.details(task.id);

      if (process.env.NODE_ENV !== 'production') {
        console.log('Task history row clicked, navigating to:', detailRoute);
      }
      navigate(detailRoute);
    }
  }, [isSelectingSourceTask, onSourceTaskSelect, toggleSelection, onSingleClickSelect, onShiftClickSelect, handleSelectItem, navigationRoute, navigate]);

  // Helper function to render task cells
  // Use compact padding for preparation view
  const isCompactView = navigationRoute === 'preparation';
  const cellPaddingClass = isCompactView ? "px-4 py-1" : "px-4 py-2";
  const checkboxPaddingClass = isCompactView ? "px-2 py-1" : "px-2 py-2";

  const renderTaskCells = useCallback((task: Task, taskIsSelected: boolean) => {
    return (
      <>
        {/* Selection checkbox - only show for users who can edit */}
        {canEdit && (
          <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
            <div className={cn("flex items-center justify-center h-full w-full", checkboxPaddingClass)} onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey && onShiftClickSelect) {
                // Use cross-table shift+click selection
                onShiftClickSelect(task.id);
              } else {
                // Regular selection or fallback shift+click
                handleSelectItem(task.id, e);
                // Update last clicked task for cross-table shift+click
                if (!e.shiftKey) {
                  onSingleClickSelect?.(task.id);
                }
              }
            }}>
              <Checkbox checked={taskIsSelected} onCheckedChange={() => handleSelectItem(task.id)} aria-label={`Select ${task.name}`} data-checkbox />
            </div>
          </TableCell>
        )}

        {/* Data columns with dynamic widths */}
        {columns.map((column) => (
          <TableCell
            key={column.id}
            className={cn(
              column.cellClassName,
              column.className,
              "p-0 !border-r-0",
            )}
            style={{
              width: getColumnWidth(column.id),
              minWidth: COLUMN_WIDTH_CONSTRAINTS.minWidth,
              maxWidth: COLUMN_WIDTH_CONSTRAINTS.maxWidth,
            }}
          >
            <div className={cn(cellPaddingClass, "relative overflow-hidden")}>
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
      </>
    );
  }, [canEdit, columns, onShiftClickSelect, handleSelectItem, onSingleClickSelect, getColumnWidth, cellPaddingClass, checkboxPaddingClass]);

  if (isLoading) {
    return <TaskHistoryTableSkeleton />;
  }


  return (
    <div className={cn("rounded-lg flex flex-col h-full overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden shrink-0">
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

              {/* Data columns with resizable headers */}
              {columns.map((column) => (
                <ColumnHeader
                  key={column.id}
                  sortable={column.sortable}
                  sortDirection={getSortDirection(column.id)}
                  sortOrder={getSortOrder(column.id)}
                  onSort={() => toggleSort(column.id)}
                  showMultipleSortOrder={sortConfigs.length > 1}
                  resizable={true}
                  width={getColumnWidth(column.id)}
                  minWidth={COLUMN_WIDTH_CONSTRAINTS.minWidth}
                  maxWidth={COLUMN_WIDTH_CONSTRAINTS.maxWidth}
                  onResize={(width) => setColumnWidth(column.id, width)}
                  className={cn(column.className, column.headerClassName)}
                  align={column.className?.includes("text-right") ? "right" : column.className?.includes("text-center") ? "center" : "left"}
                >
                  {typeof column.header === "string" ? column.header : column.header}
                </ColumnHeader>
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
                  <tr
                    key={task.id}
                    data-state={taskIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/30",
                      // Hover state
                      "hover:bg-muted/40",
                      // Selected state overrides alternating colors
                      taskIsSelected && "bg-muted/50 hover:bg-muted/60",
                      // Source selection mode highlight
                      isSelectingSourceTask && "hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary",
                    )}
                    onClick={(e) => handleTaskRowClick(e, task)}
                    onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                  >
                    {renderTaskCells(task, taskIsSelected)}
                  </tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50 shrink-0">
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
