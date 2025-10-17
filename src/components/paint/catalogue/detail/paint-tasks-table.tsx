import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList } from "@tabler/icons-react";

import type { Paint, Task } from "../../../../types";
import { routes } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { CustomerTasksTable } from "@/components/administration/customer/detail/customer-tasks-table";
import { ColumnVisibilityManager } from "@/components/production/task/history/column-visibility-manager";
import { createTaskHistoryColumns } from "@/components/production/task/history/task-history-columns";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

interface PaintTasksTableProps {
  paint: Paint;
}

// Define default visible columns for paint detail view
const DEFAULT_VISIBLE_COLUMNS = new Set([
  "name",
  "customer.fantasyName",
  "status",
  "finishedAt",
  "createdBy.name",
]);

export function PaintTasksTable({ paint }: PaintTasksTableProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Combine general paintings and logo tasks
  const allTasks = useMemo(() => [
    ...(paint.generalPaintings || []),
    ...(paint.logoTasks || []),
  ], [paint.generalPaintings, paint.logoTasks]);

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "paint-detail-tasks-visible-columns",
    DEFAULT_VISIBLE_COLUMNS
  );

  // Get all columns for visibility manager
  const allColumns = useMemo(() => createTaskHistoryColumns(), []);

  // Table data tracking
  const [tableData, setTableData] = useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Debounce search
  React.useEffect(() => {
    setIsPending(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
      setIsPending(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Filter to only show tasks from this paint, with API-based search
  const filters = useMemo(() => {
    return {
      where: {
        OR: [
          { paintId: paint.id },
          { logoPaints: { some: { id: paint.id } } },
        ],
      },
      searchingFor: debouncedSearch.trim() || undefined, // API expects 'searchingFor' parameter
    };
  }, [paint.id, debouncedSearch]);

  // Handle table data changes
  const handleTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Navigate to full tasks list with paint filter
  const handleViewAllTasks = () => {
    navigate(routes.production.history.root + `?paint=${paint.id}`);
  };

  return (
    <Card className="flex flex-col overflow-hidden min-h-[400px] max-h-[600px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Histórico de Uso
          </div>
          <Button variant="outline" size="sm" onClick={handleViewAllTasks}>
            Ver todas as tarefas
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden p-6">
        {/* Search and column visibility controls */}
        <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Buscar por nome, cliente, número de série..."
            isPending={isPending}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Table - Full width with min/max height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <CustomerTasksTable
            visibleColumns={visibleColumns}
            filters={filters}
            className="h-full border-0"
            navigationRoute="history"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}