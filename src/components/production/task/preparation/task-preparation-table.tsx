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
}: TaskPreparationTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Cast AuthUser to User for permission checks - AuthUser is a subset of User
  const canEdit = canEditTasks(user as any);

  const userSectorPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const canViewPrice = !!user && (hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) || hasPrivilege(user as any, SECTOR_PRIVILEGES.FINANCIAL));

  // Table state - NO PAGINATION for preparation
  const tableState = useTableState({
    defaultPageSize: 1000,
    defaultSort: [
      { column: 'forecastDate', direction: 'asc' },
      { column: 'name', direction: 'asc' },
      { column: 'identificador', direction: 'asc' },
    ],
    resetSelectionOnPageChange: false,
    sortStorageKey: 'task-preparation-sort',
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
  const { data, isLoading, error } = useTasks(queryParams);
  const tasks = data?.data || [];
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
              <TableHead className="sticky top-2 z-10 w-12 bg-muted border-r p-0 after:content-[''] after:absolute after:left-[-1px] after:right-[-1px] after:top-[-8px] after:h-[8px] after:bg-card after:z-[15]">
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
                className={cn("sticky top-2 z-10 after:content-[''] after:absolute after:left-[-1px] after:right-[-1px] after:top-[-8px] after:h-[8px] after:bg-card after:z-[15]", column.className, column.headerClassName)}
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
                return collapsedTasks.map((task, taskIndex) => (
                  <TableRow
                    key={task.id}
                    onClick={(e) => handleRowClick(task, e)}
                    onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      "transition-all duration-200 ease-in-out",
                      "animate-in fade-in slide-in-from-top-2",
                      isSelected(task.id) && "bg-primary/10"
                    )}
                    style={{
                      animationDelay: `${taskIndex * 30}ms`,
                      animationDuration: "200ms"
                    }}
                  >
                    {canEdit && (
                      <TableCell className="w-12 border-r p-0">
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
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn("overflow-hidden", column.cellClassName, column.className, "px-4 py-1")}
                        style={{
                          width: getColumnWidth(column.id),
                          minWidth: COLUMN_WIDTH_CONSTRAINTS.minWidth,
                          maxWidth: COLUMN_WIDTH_CONSTRAINTS.maxWidth,
                        }}
                      >
                        <div className="truncate">
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
                ));
              }

              // If collapsed, render the collapsed group row
              // Skip rendering if firstTask is not found (shouldn't happen)
              if (!firstTask) return null;

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
                />
              );
            }

            const task = group.task;
            if (!task) return null;

            return (
              <TableRow
                key={task.id}
                onClick={(e) => handleRowClick(task, e)}
                onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  isSelected(task.id) && "bg-primary/10"
                )}
              >
                {canEdit && (
                  <TableCell className="w-12 border-r p-0">
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
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn("overflow-hidden", column.cellClassName, column.className, "px-4 py-1")}
                    style={{
                      width: getColumnWidth(column.id),
                      minWidth: COLUMN_WIDTH_CONSTRAINTS.minWidth,
                      maxWidth: COLUMN_WIDTH_CONSTRAINTS.maxWidth,
                    }}
                  >
                    <div className="truncate">
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
