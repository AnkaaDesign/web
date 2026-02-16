import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "../../../../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TaskHistoryContextMenu } from "@/components/production/task/history/task-history-context-menu";
import { createTaskHistoryColumns } from "@/components/production/task/history/task-history-columns";
import { cn } from "@/lib/utils";
import { routes } from "../../../../constants";
import { useTableState } from "@/hooks/common/use-table-state";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconChevronUp, IconChevronDown, IconSelector, IconHistory } from "@tabler/icons-react";

interface BonusTasksTableProps {
  tasks: Task[];
  visibleColumns: Set<string>;
  className?: string;
  searchQuery?: string;
  showSelectedOnly?: boolean;
  selectedIds?: string[];
  onDataChange?: (data: { items: Task[]; totalRecords: number }) => void;
}

export function BonusTasksTable({
  tasks: allTasks,
  visibleColumns,
  className,
  searchQuery = "",
  showSelectedOnly: externalShowSelectedOnly,
  selectedIds: externalSelectedIds,
  onDataChange,
}: BonusTasksTableProps) {
  const navigate = useNavigate();

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use table state for pagination and selection
  const tableState = useTableState({
    defaultPageSize: 40,
    defaultSort: [{ column: "finishedAt", direction: "desc" }],
    resetSelectionOnPageChange: false,
  });

  const {
    page,
    pageSize,
    selectedIds: internalSelectedIds,
    sortConfigs,
    showSelectedOnly: internalShowSelectedOnly,
    setPage,
    setPageSize,
    toggleSelectAll,
    toggleSort,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    handleRowClick: handleRowClickSelection,
  } = tableState;

  // Use external or internal selection state
  const selectedIds = externalSelectedIds ?? internalSelectedIds;
  const showSelectedOnly = externalShowSelectedOnly ?? internalShowSelectedOnly;

  // Filter tasks by search query (client-side)
  const filteredTasks = useMemo(() => {
    let result = [...allTasks];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((task) => {
        const searchableFields = [
          task.name,
          task.customer?.fantasyName,
          task.sector?.name,
          task.serialNumber,
          task.truck?.plate,
        ];
        return searchableFields.some((field) =>
          field?.toLowerCase().includes(query)
        );
      });
    }

    // Apply show selected only filter
    if (showSelectedOnly && selectedIds.length > 0) {
      result = result.filter((task) => selectedIds.includes(task.id));
    }

    return result;
  }, [allTasks, searchQuery, showSelectedOnly, selectedIds]);

  // Sort tasks (client-side)
  const sortedTasks = useMemo(() => {
    if (sortConfigs.length === 0) return filteredTasks;

    return [...filteredTasks].sort((a, b) => {
      for (const config of sortConfigs) {
        let aValue: any;
        let bValue: any;

        switch (config.column) {
          case "name":
            aValue = a.name || "";
            bValue = b.name || "";
            break;
          case "customer.fantasyName":
            aValue = a.customer?.fantasyName || "";
            bValue = b.customer?.fantasyName || "";
            break;
          case "sector.name":
            aValue = a.sector?.name || "";
            bValue = b.sector?.name || "";
            break;
          case "finishedAt":
            aValue = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
            bValue = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
            break;
          case "serialNumber":
            aValue = a.serialNumber || "";
            bValue = b.serialNumber || "";
            break;
          case "commission":
            aValue = a.commission || "";
            bValue = b.commission || "";
            break;
          default:
            aValue = "";
            bValue = "";
        }

        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue, "pt-BR");
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        }

        if (config.direction === "desc") {
          comparison = -comparison;
        }

        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  }, [filteredTasks, sortConfigs]);

  // Paginate tasks (client-side)
  const totalRecords = sortedTasks.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const paginatedTasks = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return sortedTasks.slice(start, end);
  }, [sortedTasks, page, pageSize]);

  // Notify parent of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = `${totalRecords}-${paginatedTasks.map((t) => t.id).join(",")}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: paginatedTasks, totalRecords });
      }
    }
  }, [paginatedTasks, totalRecords, onDataChange]);

  // Define all available columns
  const allColumns = useMemo(() => createTaskHistoryColumns(), []);

  // Filter visible columns
  const columns = useMemo(
    () => allColumns.filter((col) => visibleColumns.has(col.id)),
    [allColumns, visibleColumns]
  );

  // Check selection state for current page
  const currentPageIds = paginatedTasks.map((task) => task.id);
  const allSelected = isAllSelected(currentPageIds);
  const partiallySelected = isPartiallySelected(currentPageIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageIds);
  };

  const handleSelectItem = (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    handleRowClickSelection(id, currentPageIds, event?.shiftKey || false);
  };

  const renderSortIndicator = (columnKey: string) => {
    const currentSort = sortConfigs.find((s) => s.column === columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {!currentSort && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {currentSort?.direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {currentSort?.direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {currentSort && sortConfigs.length > 1 && (
          <span className="text-xs ml-0.5">{sortConfigs.findIndex((s) => s.column === columnKey) + 1}</span>
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

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();

    const isTaskSelected = isSelected(task.id);
    const hasSelection = selectedIds.length > 0;

    if (hasSelection && isTaskSelected) {
      const selectedTasksList = paginatedTasks.filter((t) => isSelected(t.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        tasks: selectedTasksList,
        isBulk: true,
      });
    } else {
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
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={cn("rounded-lg flex flex-col min-h-[400px] max-h-[800px]", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg flex-shrink-0">
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
                    aria-label="Select all tasks"
                    disabled={paginatedTasks.length === 0}
                  />
                </div>
              </TableHead>

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead key={column.id} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      )}
                      disabled={paginatedTasks.length === 0}
                    >
                      <TruncatedTextWithTooltip text={String(column.header)} />
                      {renderSortIndicator(column.id)}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <TruncatedTextWithTooltip text={String(column.header)} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Scrollbar spacer */}
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
            {paginatedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconHistory className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</div>
                    {searchQuery ? (
                      <div className="text-sm">Ajuste a busca para ver mais resultados.</div>
                    ) : (
                      <div className="text-sm">Nenhuma tarefa no período.</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTasks.map((task, index) => {
                const taskIsSelected = isSelected(task.id);

                return (
                  <TableRow
                    key={task.id}
                    data-state={taskIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      taskIsSelected && "bg-muted/30 hover:bg-muted/40"
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-checkbox]")) {
                        return;
                      }
                      navigate(routes.production.history.details(task.id));
                    }}
                    onContextMenu={(e) => handleContextMenu(e, task)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => {
                        e.stopPropagation();
                        handleSelectItem(task.id, e);
                      }}>
                        <Checkbox checked={taskIsSelected} onCheckedChange={() => handleSelectItem(task.id)} aria-label={`Select ${task.name}`} data-checkbox />
                      </div>
                    </TableCell>

                    {/* Data columns */}
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(column.className, "p-0 !border-r-0")}
                      >
                        <div className="px-4 py-2">
                          {column.formatter
                            ? column.formatter(
                                column.accessorFn
                                  ? column.accessorFn(task)
                                  : task[column.accessorKey as keyof Task],
                                task
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
      {contextMenu && (
        <TaskHistoryContextMenu
          // @ts-expect-error - component prop mismatch
          task={contextMenu.tasks[0]}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          selectedIds={contextMenu.isBulk ? selectedIds : [contextMenu.tasks[0]?.id].filter(Boolean)}
        />
      )}
    </div>
  );
}
