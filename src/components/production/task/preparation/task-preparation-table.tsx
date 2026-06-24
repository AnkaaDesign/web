import React, { useMemo, useCallback, useState, useEffect } from "react";
import type { Task } from "@/types";
import type { TaskGetManyFormData } from "@/schemas";
import { useTasks } from "@/hooks";
import { useAuth } from "@/contexts/auth-context";
import { canEditTasks } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SECTOR_PRIVILEGES } from "@/constants";
import { hasPrivilege } from "@/utils/user";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { TaskHistoryContextMenu } from "../history/task-history-context-menu";
import { createTaskHistoryColumns } from "../history/task-history-columns";
import { TaskHistoryTableSkeleton } from "../history/task-history-table-skeleton";
import { useNavigate } from "react-router-dom";
import { routes } from "@/constants";
import { groupSequentialTasks } from "../history/task-grouping-utils";
import { CollapsedGroupRow } from "../history/collapsed-group-row";
import { ColumnHeader } from "@/components/ui/column-header";
import { COLUMN_WIDTH_CONSTRAINTS } from "@/hooks/common/use-column-widths";
import { IconAlertTriangle } from "@tabler/icons-react";

// Columns that hold dates and must be compared chronologically (nulls last).
const DATE_SORT_COLUMNS = new Set(["forecastDate", "entryDate", "startedAt", "finishedAt", "term", "createdAt"]);

// Extract the comparable value + its type for a given sortable column. Mirrors the
// accessors used by the task columns so a client-side sort matches the cells.
function getTaskSortValue(task: Task, columnId: string): { type: "date" | "number" | "string"; value: number | string | null } {
  switch (columnId) {
    case "identificador":
      return { type: "string", value: task.serialNumber || task.truck?.plate || "" };
    case "name":
      return { type: "string", value: task.name || "" };
    case "customer.fantasyName":
      return { type: "string", value: task.customer?.corporateName || task.customer?.fantasyName || "" };
    case "sector.name":
      return { type: "string", value: task.sector?.name || "" };
    case "chassisNumber":
      return { type: "string", value: task.truck?.chassisNumber || "" };
    case "truckCategory":
      return { type: "string", value: task.truck?.category || "" };
    case "implementType":
      return { type: "string", value: task.truck?.implementType || "" };
    case "status":
      return { type: "number", value: (task as any).statusOrder ?? null };
    case "price":
      return { type: "number", value: task.quote?.total ?? null };
    default:
      if (DATE_SORT_COLUMNS.has(columnId)) {
        const raw = (task as any)[columnId];
        return { type: "date", value: raw ? new Date(raw).getTime() : null };
      }
      const fallback = (task as any)[columnId];
      return { type: "string", value: fallback == null ? "" : String(fallback) };
  }
}

// Client-side comparator that honors the active multi-column sort. Strings use a
// numeric-aware (natural) collation so serial numbers sort 9 < 10 < 100 instead of
// lexicographically; nulls/empties always sort last, matching the server's `nulls: "last"`.
function compareTasksBySort(a: Task, b: Task, sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>): number {
  for (const { column, direction } of sortConfigs) {
    const dir = direction === "desc" ? -1 : 1;
    const av = getTaskSortValue(a, column);
    const bv = getTaskSortValue(b, column);
    let cmp = 0;

    if (av.type === "date" || av.type === "number") {
      const an = av.value as number | null;
      const bn = bv.value as number | null;
      if (an === bn) cmp = 0;
      else if (an === null) cmp = 1; // nulls last regardless of direction
      else if (bn === null) cmp = -1;
      else cmp = (an < bn ? -1 : 1) * dir;
    } else {
      const as = (av.value as string) || "";
      const bs = (bv.value as string) || "";
      if (!as && !bs) cmp = 0;
      else if (!as) cmp = 1; // empties last regardless of direction
      else if (!bs) cmp = -1;
      else cmp = as.localeCompare(bs, "pt-BR", { numeric: true, sensitivity: "base" }) * dir;
    }

    if (cmp !== 0) return cmp;
  }
  return 0;
}

interface TaskPreparationTableProps {
  visibleColumns: Set<string>;
  columnOrder?: string[];
  className?: string;
  filters?: Partial<TaskGetManyFormData>;
  onDataChange?: (data: { items: Task[]; totalRecords: number }) => void;
  advancedActionsRef?: React.RefObject<{ openModal: (type: string, taskIds: string[]) => void } | null>;
  onStartCopyFromTask?: (targetTasks: Task[]) => void;
  isSelectingSourceTask?: boolean;
  onSourceTaskSelect?: (task: Task) => void;
  onShiftClickSelect?: (taskId: string) => void;
  onSingleClickSelect?: (taskId: string) => void;
  externalExpandedGroups?: Set<string>;
  onExpandedGroupsChange?: (expandedGroups: Set<string>) => void;
  onGroupsDetected?: (groupIds: string[], hasGroups: boolean) => void;
  onOrderedTaskIdsChange?: (orderedIds: string[]) => void;
  showSelectedOnly?: boolean;
  allOrderedTaskIds?: string[];
  /** Shared column width getter (lifted from parent so all tables resize together) */
  getColumnWidth: (columnId: string) => number;
  /** Shared column width setter */
  setColumnWidth: (columnId: string, width: number) => void;
  /** Override refetchOnWindowFocus for the underlying query */
  refetchOnWindowFocus?: boolean | 'always';
  /** localStorage key for persisting sort configuration per table */
  sortStorageKey?: string;
}

export function TaskPreparationTable({
  visibleColumns,
  columnOrder,
  className,
  filters = {},
  onDataChange,
  advancedActionsRef,
  onStartCopyFromTask,
  isSelectingSourceTask,
  onSourceTaskSelect,
  onShiftClickSelect,
  onSingleClickSelect,
  externalExpandedGroups,
  onExpandedGroupsChange,
  onGroupsDetected,
  onOrderedTaskIdsChange,
  showSelectedOnly = false,
  allOrderedTaskIds,
  getColumnWidth,
  setColumnWidth,
  refetchOnWindowFocus,
  sortStorageKey = 'task-preparation-sort',
}: TaskPreparationTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Cast AuthUser to User for permission checks - AuthUser is a subset of User
  const canEdit = canEditTasks(user as any);

  const userSectorPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const canViewPrice = !!user && (hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) || hasPrivilege(user as any, SECTOR_PRIVILEGES.COMMERCIAL) || hasPrivilege(user as any, SECTOR_PRIVILEGES.FINANCIAL));

  // Table state - NO PAGINATION for preparation
  const tableState = useTableState({
    defaultPageSize: 1000,
    defaultSort: [
      { column: 'forecastDate', direction: 'asc' },
      { column: 'name', direction: 'asc' },
      { column: 'identificador', direction: 'asc' },
    ],
    resetSelectionOnPageChange: false,
    sortStorageKey,
    useUrlForSort: false,
  });

  const {
    selectedIds,
    sortConfigs,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    setSelectedIds, // Add this to update selection in bulk
  } = tableState;

  // Expanded groups state
  const [internalExpandedGroups, setInternalExpandedGroups] = useState<Set<string>>(new Set());
  const expandedGroups = externalExpandedGroups ?? internalExpandedGroups;
  const setExpandedGroups = onExpandedGroupsChange ?? setInternalExpandedGroups;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tasks: Task[];
    isBulk: boolean;
  } | null>(null);

  // Build query with sorting and showSelectedOnly filter
  const queryParams = useMemo(() => {
    return {
      ...filters,
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
  }, [filters, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch tasks
  const { data, isLoading, error } = useTasks({ ...queryParams, refetchOnWindowFocus });
  // The server sorts `identificador` (serialNumber) lexicographically, so "10" lands
  // before "9". When that column is part of the active sort, re-sort client-side with a
  // numeric-aware comparator so serial numbers order naturally. This same order flows to
  // the batch-edit page, since the context menu builds its URL from this list.
  const tasks = useMemo(() => {
    const base = data?.data || [];
    if (!sortConfigs.some((c) => c.column === "identificador")) return base;
    return [...base].sort((a, b) => compareTasksBySort(a, b, sortConfigs));
  }, [data?.data, sortConfigs]);
  const totalRecords = data?.meta?.totalRecords || 0;

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange && data) {
      onDataChange({ items: tasks, totalRecords });
    }
  }, [tasks, totalRecords, onDataChange, data]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    const grouped = groupSequentialTasks(tasks, 3, 0.95);
    return grouped;
  }, [tasks]);

  // Notify parent about groups
  useEffect(() => {
    if (onGroupsDetected) {
      const groupIds = groupedTasks
        .filter(g => g.type === 'group-collapsed')
        .map(g => g.groupId)
        .filter((id): id is string => id !== undefined);
      onGroupsDetected(groupIds, groupIds.length > 0);
    }
  }, [groupedTasks, onGroupsDetected]);

  // Selection adjacency map - drives the green wrapping border for contiguous selected rows.
  // Each rendered row (single, group-first, expanded group task, or collapsed group row) gets
  // a flag indicating whether it's at the top/bottom of a contiguous run of selections.
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectionAdjacency = useMemo(() => {
    type RowSel = { key: string; isSelected: boolean };
    const flat: RowSel[] = [];
    for (const group of groupedTasks) {
      if (group.type === 'group-collapsed') {
        const groupId = group.groupId!;
        const isExpanded = expandedGroups.has(groupId);
        if (isExpanded) {
          for (const t of group.collapsedTasks ?? []) {
            flat.push({ key: `task-${t.id}`, isSelected: selectedIdsSet.has(t.id) });
          }
        } else {
          const firstTaskGroup = groupedTasks.find(g => g.groupId === groupId && g.type === 'group-first');
          const allIds: string[] = [];
          if (firstTaskGroup?.task) allIds.push(firstTaskGroup.task.id);
          allIds.push(...(group.collapsedTasks ?? []).map(t => t.id));
          const allSel = allIds.length > 0 && allIds.every(id => selectedIdsSet.has(id));
          flat.push({ key: `collapsed-${groupId}`, isSelected: allSel });
        }
      } else if (group.task) {
        const t = group.task;
        let sel: boolean;
        if (group.type === 'group-first') {
          // For a group-first row when the group is collapsed, its checkbox represents the
          // entire group's selection state — match that here so the visuals stay consistent.
          let foundGroupId: string | undefined;
          for (const g of groupedTasks) {
            if (g.type === 'group-first' && g.task?.id === t.id) {
              foundGroupId = g.groupId;
              break;
            }
          }
          const groupCollapsed = !!foundGroupId && !expandedGroups.has(foundGroupId);
          if (groupCollapsed) {
            const allIds: string[] = [t.id];
            for (const g of groupedTasks) {
              if (g.groupId === foundGroupId && g.type === 'group-collapsed' && g.collapsedTasks) {
                allIds.push(...g.collapsedTasks.map(x => x.id));
              }
            }
            sel = allIds.every(id => selectedIdsSet.has(id));
          } else {
            sel = selectedIdsSet.has(t.id);
          }
        } else {
          sel = selectedIdsSet.has(t.id);
        }
        flat.push({ key: `task-${t.id}`, isSelected: sel });
      }
    }
    const map = new Map<string, { isSelected: boolean; isFirstInRun: boolean; isLastInRun: boolean }>();
    flat.forEach((row, i) => {
      const before = i > 0 ? flat[i - 1].isSelected : false;
      const after = i < flat.length - 1 ? flat[i + 1].isSelected : false;
      map.set(row.key, {
        isSelected: row.isSelected,
        isFirstInRun: row.isSelected && !before,
        isLastInRun: row.isSelected && !after,
      });
    });
    return map;
  }, [groupedTasks, expandedGroups, selectedIdsSet]);

  // When showing only selected rows, the green tint is enough — skip the wrapping
  // border since every visible row is selected and the border becomes visual noise.
  const showSelectionBorders = !showSelectedOnly;

  // Per-cell shadow. With `border-collapse: collapse`, box-shadow on `<tr>` is hidden
  // by the cells' own boxes, so we apply shadows to each `<td>` instead. Each cell only
  // contributes the shadow edges that belong to it (left on first col, right on last col,
  // top on first-in-run, bottom on last-in-run).
  const buildCellShadow = useCallback((opts: {
    isSelected: boolean;
    isFirstInRun: boolean;
    isLastInRun: boolean;
    isFirstCol: boolean;
    isLastCol: boolean;
  }): string | undefined => {
    if (!opts.isSelected || !showSelectionBorders) return undefined;
    const c = 'rgb(34 197 94)';
    const shadows: string[] = [];
    if (opts.isFirstCol) shadows.push(`inset 2px 0 0 ${c}`);
    if (opts.isLastCol) shadows.push(`inset -2px 0 0 ${c}`);
    if (opts.isFirstInRun) shadows.push(`inset 0 2px 0 ${c}`);
    if (opts.isLastInRun) shadows.push(`inset 0 -2px 0 ${c}`);
    return shadows.length ? shadows.join(', ') : undefined;
  }, [showSelectionBorders]);

  // Notify parent about ordered task IDs
  useEffect(() => {
    if (onOrderedTaskIdsChange) {
      const orderedIds: string[] = [];
      for (const group of groupedTasks) {
        if (group.type === 'group-first' || group.type === 'single') {
          if (group.task) orderedIds.push(group.task.id);
        } else if (group.type === 'group-collapsed') {
          if (group.collapsedTasks) {
            orderedIds.push(...group.collapsedTasks.map(t => t.id));
          }
        }
      }
      onOrderedTaskIdsChange(orderedIds);
    }
  }, [groupedTasks, onOrderedTaskIdsChange]);

  // Columns
  const allColumns = useMemo(
    () => createTaskHistoryColumns({
      canViewPrice,
      currentUserId: user?.id,
      sectorPrivilege: userSectorPrivilege,
      navigationRoute: 'preparation',
    }),
    [canViewPrice, user?.id, userSectorPrivilege]
  );

  const columns = useMemo(() => {
    const visible = allColumns.filter(col => visibleColumns.has(col.id));
    if (!columnOrder?.length) return visible;
    const orderMap = new Map(columnOrder.map((id, idx) => [id, idx]));
    return [...visible].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }, [allColumns, visibleColumns, columnOrder]);

  // Context menu handlers
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, task: Task) => {
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
  }, [tasks, selectedIds, isSelected]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    toggleSelectAll(tasks.map(t => t.id));
  }, [toggleSelectAll, tasks]);

  const allSelected = tasks.length > 0 && isAllSelected(tasks.map(t => t.id));
  const partiallySelected = isPartiallySelected(tasks.map(t => t.id));

  /**
   * Get comprehensive group information for a task
   *
   * This helper determines:
   * - Whether the task is part of a group (first task only, since we no longer have last)
   * - Whether that group is currently expanded or collapsed
   * - All task IDs in the group (first + rest)
   *
   * Used to implement context-aware selection:
   * - COLLAPSED: Clicking first task selects entire group
   * - EXPANDED: Each task is independent
   *
   * @param taskId - The ID of the task to check
   * @returns Group information object
   */
  const getGroupInfo = useCallback((taskId: string): {
    isInGroup: boolean;
    groupId?: string;
    isExpanded: boolean;
    allTaskIds: string[];
  } => {
    // Find if this task belongs to a group (only check group-first now)
    let foundGroupId: string | undefined;

    for (const group of groupedTasks) {
      if (group.type === 'group-first' && group.task?.id === taskId) {
        foundGroupId = group.groupId;
        break;
      }
    }

    // If not in a group, return single task info
    if (!foundGroupId) {
      return {
        isInGroup: false,
        isExpanded: false,
        allTaskIds: [taskId],
      };
    }

    // Collect all task IDs in the group (first + collapsed)
    const allTaskIds: string[] = [];
    for (const g of groupedTasks) {
      if (g.groupId === foundGroupId) {
        if (g.type === 'group-first' && g.task) {
          allTaskIds.push(g.task.id);
        } else if (g.type === 'group-collapsed' && g.collapsedTasks) {
          allTaskIds.push(...g.collapsedTasks.map(t => t.id));
        }
      }
    }

    const isExpanded = expandedGroups.has(foundGroupId);

    return {
      isInGroup: true,
      groupId: foundGroupId,
      isExpanded: isExpanded,
      allTaskIds: allTaskIds.length > 0 ? allTaskIds : [taskId],
    };
  }, [groupedTasks, expandedGroups]);

  // Row click handler - now navigates instead of selecting
  const handleRowClick = useCallback((task: Task, event: React.MouseEvent) => {
    // Special mode: selecting source task for copy-from-task
    if (isSelectingSourceTask && onSourceTaskSelect) {
      onSourceTaskSelect(task);
      return;
    }

    // Don't navigate if clicking checkbox
    const isCheckboxClick = (event.target as HTMLElement).closest('input[type="checkbox"]');
    if (isCheckboxClick) return;

    // Navigate to detail page (normal click behavior)
    navigate(routes.production.preparation.details(task.id), {
      state: allOrderedTaskIds ? { taskIds: allOrderedTaskIds } : undefined,
    });
  }, [isSelectingSourceTask, onSourceTaskSelect, navigate, allOrderedTaskIds]);

  if (isLoading) {
    return <TaskHistoryTableSkeleton />;
  }

  return (
    <div className={cn("rounded-lg border border-border relative overflow-clip", className)}>
      <Table className="w-full table-fixed [&>div]:border-0 [&>div]:rounded-none">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted border-b-2 border-border">
            {/* Selection checkbox */}
            {canEdit && (
              <TableHead
                className="sticky z-10 w-12 bg-muted border-r p-0 transition-[top] duration-200 ease-out after:content-[''] after:absolute after:left-[-1px] after:right-[-1px] after:-top-28 after:h-28 after:bg-background after:z-[15]"
                style={{ top: 'var(--sticky-header-offset, 0.5rem)' }}
              >
                <div className="flex items-center justify-center h-full w-full px-2 py-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    disabled={tasks.length === 0}
                    aria-label="Select all tasks"
                  />
                </div>
              </TableHead>
            )}

            {/* Column headers */}
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
                className={cn("sticky z-10 transition-[top] duration-200 ease-out after:content-[''] after:absolute after:left-[-1px] after:right-[-1px] after:-top-28 after:h-28 after:bg-background after:z-[15]", column.className, column.headerClassName)}
                style={{ top: 'var(--sticky-header-offset, 0.5rem)' }}
              >
                {column.header}
              </ColumnHeader>
            ))}

          </TableRow>
        </TableHeader>

        <TableBody>
          {error ? (
            <TableRow>
              <TableCell colSpan={columns.length + (canEdit ? 1 : 0)} className="p-0">
                <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                  <IconAlertTriangle className="h-8 w-8 mb-4" />
                  <div className="text-lg font-medium mb-2">Não foi possível carregar as tarefas</div>
                  <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                </div>
              </TableCell>
            </TableRow>
          ) : tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (canEdit ? 1 : 0)} className="p-0">
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <div className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</div>
                  <div className="text-sm">Tente ajustar os filtros ou criar uma nova tarefa.</div>
                </div>
              </TableCell>
            </TableRow>
          ) : null}
          {groupedTasks.map((group, _idx) => {
            if (group.type === 'group-collapsed') {
              const groupId = group.groupId!;
              const collapsedTasks = group.collapsedTasks!;
              const isExpanded = expandedGroups.has(groupId);

              // Find first task for this group
              const firstTaskGroup = groupedTasks.find(g => g.groupId === groupId && g.type === 'group-first');
              const firstTask = firstTaskGroup?.task;

              // Calculate selection state for the group - need to check first + collapsed tasks
              const allGroupTaskIds: string[] = [];

              // Add first task
              if (firstTask) allGroupTaskIds.push(firstTask.id);

              // Add collapsed tasks (rest of the group)
              allGroupTaskIds.push(...collapsedTasks.map(t => t.id));

              const selectedCountInGroup = allGroupTaskIds.filter(id => isSelected(id)).length;
              const allTasksSelected = selectedCountInGroup === allGroupTaskIds.length;

              // Handle select all in group - includes first + collapsed tasks
              const handleSelectAllInGroup = () => {
                // Build the new selection set in ONE operation to avoid race conditions
                const currentSelection = new Set(selectedIds);

                if (allTasksSelected) {
                  // Deselect all tasks in the group
                  allGroupTaskIds.forEach(id => {
                    currentSelection.delete(id);
                  });
                } else {
                  // Select all tasks in the group
                  allGroupTaskIds.forEach(id => {
                    currentSelection.add(id);
                  });
                }

                // Update selection in ONE call
                setSelectedIds(Array.from(currentSelection));
              };

              // If expanded, render all individual task rows
              if (isExpanded) {
                return collapsedTasks.map((task, taskIndex) => {
                  const adj = selectionAdjacency.get(`task-${task.id}`);
                  const rowSelected = adj?.isSelected ?? false;
                  const lastColIdx = columns.length - 1;
                  const checkboxShadow = buildCellShadow({
                    isSelected: rowSelected,
                    isFirstInRun: !!adj?.isFirstInRun,
                    isLastInRun: !!adj?.isLastInRun,
                    isFirstCol: true,
                    isLastCol: false,
                  });
                  return (
                  <TableRow
                    key={task.id}
                    onClick={(e) => handleRowClick(task, e)}
                    onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      "transition-all duration-200 ease-in-out",
                      "animate-in fade-in slide-in-from-top-2",
                      rowSelected && "bg-green-500/15 hover:bg-green-500/25"
                    )}
                    style={{
                      animationDelay: `${taskIndex * 30}ms`,
                      animationDuration: "200ms",
                    }}
                  >
                    {canEdit && (
                      <TableCell
                        className="w-12 border-r p-0"
                        style={checkboxShadow ? { boxShadow: checkboxShadow } : undefined}
                      >
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-1"
                          onMouseDown={(e) => {
                            // Prevent text selection when shift-clicking
                            if (e.shiftKey) {
                              e.preventDefault();
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey && onShiftClickSelect) {
                              e.preventDefault(); // Prevent text selection when shift-clicking
                              onShiftClickSelect(task.id);
                            } else {
                              if (onSingleClickSelect && !e.shiftKey) {
                                onSingleClickSelect(task.id);
                              }
                              // When clicking checkbox in expanded group, select just this task
                              toggleSelection(task.id);
                            }
                          }}
                        >
                          <Checkbox
                            checked={isSelected(task.id)}
                            style={{ pointerEvents: 'none' }}
                            aria-label={`Select ${task.name}`}
                          />
                        </div>
                      </TableCell>
                    )}
                    {columns.map((column, colIdx) => {
                      const cellShadow = buildCellShadow({
                        isSelected: rowSelected,
                        isFirstInRun: !!adj?.isFirstInRun,
                        isLastInRun: !!adj?.isLastInRun,
                        isFirstCol: !canEdit && colIdx === 0,
                        isLastCol: colIdx === lastColIdx,
                      });
                      return (
                      <TableCell
                        key={column.id}
                        className={cn("overflow-hidden", column.cellClassName, column.className, "px-4 py-1")}
                        style={{
                          width: getColumnWidth(column.id),
                          minWidth: COLUMN_WIDTH_CONSTRAINTS.minWidth,
                          maxWidth: COLUMN_WIDTH_CONSTRAINTS.maxWidth,
                          ...(cellShadow ? { boxShadow: cellShadow } : {}),
                        }}
                      >
                        <div className="truncate flex items-center">
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
                      );
                    })}
                  </TableRow>
                  );
                });
              }

              // If collapsed, render the collapsed group row
              // Skip rendering if firstTask is not found (shouldn't happen)
              if (!firstTask) return null;

              const collapsedAdj = selectionAdjacency.get(`collapsed-${groupId}`);

              return (
                <CollapsedGroupRow
                  key={groupId}
                  groupId={groupId}
                  collapsedTasks={collapsedTasks}
                  firstTask={firstTask}
                  totalCount={group.totalCount!}
                  isExpanded={isExpanded}
                  onToggle={() => {
                    const newExpanded = new Set(expandedGroups);
                    if (newExpanded.has(groupId)) {
                      newExpanded.delete(groupId);
                    } else {
                      newExpanded.add(groupId);
                    }
                    setExpandedGroups(newExpanded);
                    if (onExpandedGroupsChange) {
                      onExpandedGroupsChange(newExpanded);
                    }
                  }}
                  isSelected={allTasksSelected}
                  onSelectAll={handleSelectAllInGroup}
                  canEdit={canEdit}
                  columns={columns}
                  selectedCount={selectedCountInGroup}
                  highlightSelection={!!collapsedAdj?.isSelected}
                  isFirstInRun={!!collapsedAdj?.isFirstInRun}
                  isLastInRun={!!collapsedAdj?.isLastInRun}
                  showSelectionBorder={showSelectionBorders}
                />
              );
            }

            const task = group.task;
            if (!task) return null;

            const taskAdj = selectionAdjacency.get(`task-${task.id}`);
            const taskRowSelected = taskAdj?.isSelected ?? false;
            const taskLastColIdx = columns.length - 1;
            const taskCheckboxShadow = buildCellShadow({
              isSelected: taskRowSelected,
              isFirstInRun: !!taskAdj?.isFirstInRun,
              isLastInRun: !!taskAdj?.isLastInRun,
              isFirstCol: true,
              isLastCol: false,
            });

            return (
              <TableRow
                key={task.id}
                onClick={(e) => handleRowClick(task, e)}
                onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  taskRowSelected && "bg-green-500/15 hover:bg-green-500/25"
                )}
              >
                {canEdit && (
                  <TableCell
                    className="w-12 border-r p-0"
                    style={taskCheckboxShadow ? { boxShadow: taskCheckboxShadow } : undefined}
                  >
                    <div
                      className="flex items-center justify-center h-full w-full px-2 py-1"
                      onMouseDown={(e) => {
                        // Prevent text selection when shift-clicking
                        if (e.shiftKey) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();

                        // Handle shift-click for range selection
                        if (e.shiftKey && onShiftClickSelect) {
                          e.preventDefault(); // Prevent text selection when shift-clicking
                          onShiftClickSelect(task.id);
                          return;
                        }

                        // Update last clicked task for future shift-clicks
                        if (onSingleClickSelect && !e.shiftKey) {
                          onSingleClickSelect(task.id);
                        }

                        // Get comprehensive group information
                        const groupInfo = getGroupInfo(task.id);

                        // Determine which tasks to toggle based on group state
                        let tasksToToggle: string[];

                        if (groupInfo.isInGroup && !groupInfo.isExpanded) {
                          // COLLAPSED GROUP: Select all tasks in group (first + rest)
                          tasksToToggle = groupInfo.allTaskIds;
                        } else {
                          // SINGLE TASK or EXPANDED GROUP: Select only this task
                          tasksToToggle = [task.id];
                        }

                        // Determine if we're selecting or deselecting
                        const allSelected = tasksToToggle.every(id => isSelected(id));

                        // Build new selection set in ONE operation (avoid race conditions)
                        const currentSelection = new Set(selectedIds);

                        tasksToToggle.forEach(id => {
                          if (allSelected) {
                            currentSelection.delete(id);
                          } else {
                            currentSelection.add(id);
                          }
                        });

                        // Update selection in ONE call
                        setSelectedIds(Array.from(currentSelection));
                      }}
                    >
                      <Checkbox
                        checked={(() => {
                          const groupInfo = getGroupInfo(task.id);

                          if (groupInfo.isInGroup && !groupInfo.isExpanded) {
                            // COLLAPSED GROUP: Show checked if all tasks in group are selected
                            return groupInfo.allTaskIds.every(id => isSelected(id));
                          }

                          // SINGLE TASK or EXPANDED GROUP: Show checked if this task is selected
                          return isSelected(task.id);
                        })()}
                        indeterminate={(() => {
                          const groupInfo = getGroupInfo(task.id);

                          if (groupInfo.isInGroup && !groupInfo.isExpanded) {
                            // COLLAPSED GROUP: Show indeterminate if some (but not all) are selected
                            const selectedCount = groupInfo.allTaskIds.filter(id => isSelected(id)).length;
                            return selectedCount > 0 && selectedCount < groupInfo.allTaskIds.length;
                          }

                          // SINGLE TASK or EXPANDED GROUP: Never indeterminate
                          return false;
                        })()}
                        style={{ pointerEvents: 'none' }}
                        aria-label={`Select ${task.name}`}
                      />
                    </div>
                  </TableCell>
                )}
                {columns.map((column, colIdx) => {
                  const cellShadow = buildCellShadow({
                    isSelected: taskRowSelected,
                    isFirstInRun: !!taskAdj?.isFirstInRun,
                    isLastInRun: !!taskAdj?.isLastInRun,
                    isFirstCol: !canEdit && colIdx === 0,
                    isLastCol: colIdx === taskLastColIdx,
                  });
                  return (
                  <TableCell
                    key={column.id}
                    className={cn("overflow-hidden", column.cellClassName, column.className, "px-4 py-1")}
                    style={{
                      width: getColumnWidth(column.id),
                      minWidth: COLUMN_WIDTH_CONSTRAINTS.minWidth,
                      maxWidth: COLUMN_WIDTH_CONSTRAINTS.maxWidth,
                      ...(cellShadow ? { boxShadow: cellShadow } : {}),
                    }}
                  >
                    <div className="truncate flex items-center">
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
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Context Menu */}
      {contextMenu && (
        <TaskHistoryContextMenu
          tasks={contextMenu.tasks}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleContextMenuClose}
          selectedIds={contextMenu.isBulk ? selectedIds : [contextMenu.tasks[0]?.id].filter(Boolean)}
          navigationRoute="preparation"
          advancedActionsRef={advancedActionsRef}
          onStartCopyFromTask={onStartCopyFromTask}
        />
      )}
    </div>
  );
}
