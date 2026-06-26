import React, { useState, useMemo, useCallback } from "react";
import type { Task } from "../../../../types";
import { useTableState } from "@/hooks/common/use-table-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { BonusTasksTable } from "./bonus-tasks-table";
import { ColumnVisibilityManager } from "@/components/production/task/history/column-visibility-manager";
import { createTaskHistoryColumns } from "@/components/production/task/history/task-history-columns";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { IconClipboardList } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { BONIFICATION_STATUS, getBadgeVariant } from "../../../../constants";

interface BonusTasksListProps {
  className?: string;
  tasks: Task[];
  title?: string;
}

// Bonification stats helper
const getBonificationStats = (tasks: Task[]) => {
  const fullBonification = tasks.filter((t) => t.bonification === BONIFICATION_STATUS.FULL_BONIFICATION).length;
  const partialBonification = tasks.filter((t) => t.bonification === BONIFICATION_STATUS.PARTIAL_BONIFICATION).length;
  const noBonification = tasks.filter((t) => t.bonification === BONIFICATION_STATUS.NO_BONIFICATION).length;
  const suspendedBonification = tasks.filter((t) => t.bonification === BONIFICATION_STATUS.SUSPENDED_BONIFICATION).length;

  return { fullBonification, partialBonification, noBonification, suspendedBonification };
};

export function BonusTasksList({
  className,
  tasks,
  title = "Tarefas do Período",
}: BonusTasksListProps) {
  // Search state with debouncing
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  // Get table state for selected tasks functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Default visible columns for bonus tasks
  const defaultVisibleColumns = useMemo(
    () =>
      new Set([
        "name",
        "customer.fantasyName",
        "sector.name",
        "finishedAt",
        "bonification",
      ]),
    []
  );

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "bonus-detail-tasks-visible-columns",
    defaultVisibleColumns
  );

  // Table data for tracking
  const [_tableData, setTableData] = useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Get all columns for visibility manager
  const allColumns = useMemo(() => createTaskHistoryColumns(), []);

  // Handle table data changes
  const handleTableDataChange = useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Bonification stats
  const bonificationStats = useMemo(() => getBonificationStats(tasks), [tasks]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border w-full", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            {title} ({tasks.length})
          </div>
          {/* Bonification summary badges - responsive layout */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={getBadgeVariant(BONIFICATION_STATUS.FULL_BONIFICATION, "BONIFICATION_STATUS") as any}>
              Bonificação Integral: {bonificationStats.fullBonification}
            </Badge>
            <Badge variant={getBadgeVariant(BONIFICATION_STATUS.PARTIAL_BONIFICATION, "BONIFICATION_STATUS") as any}>
              Bonificação Parcial: {bonificationStats.partialBonification}
            </Badge>
            <Badge variant={getBadgeVariant(BONIFICATION_STATUS.NO_BONIFICATION, "BONIFICATION_STATUS") as any}>
              Sem Bonificação: {bonificationStats.noBonification}
            </Badge>
            <Badge variant={getBadgeVariant(BONIFICATION_STATUS.SUSPENDED_BONIFICATION, "BONIFICATION_STATUS") as any}>
              Bonificação Suspensa: {bonificationStats.suspendedBonification}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Buscar por nome, cliente, setor..."
            isPending={searchText !== debouncedSearch}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectionCount}
            />
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1">
          <BonusTasksTable
            tasks={tasks}
            visibleColumns={visibleColumns}
            searchQuery={debouncedSearch}
            showSelectedOnly={showSelectedOnly}
            selectedIds={selectedIds}
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
