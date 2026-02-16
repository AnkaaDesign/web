import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList } from "@tabler/icons-react";

import type { Sector, Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { routes, TASK_STATUS } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { CustomerTasksTable } from "@/components/administration/customer/detail/customer-tasks-table";
import { ColumnVisibilityManager } from "@/components/production/task/history/column-visibility-manager";
import { createTaskHistoryColumns } from "@/components/production/task/history/task-history-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { useTableFilters } from "@/hooks/common/use-table-filters";

interface SectorTasksTableProps {
  sector: Sector;
}

// Define comprehensive visible columns for sector detail view
const SECTOR_DETAIL_TASK_VISIBLE_COLUMNS = new Set([
  "name",
  "customer.fantasyName",
  "status",
  "finishedAt",
  "createdBy.name",
]);

export function SectorTasksTable({ sector }: SectorTasksTableProps) {
  const navigate = useNavigate();

  // Table data tracking
  const [_tableData, setTableData] = useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Use table filters for search functionality
  const {
    searchingFor,
    displaySearchText,
    setSearch,
  } = useTableFilters<TaskGetManyFormData>({
    defaultFilters: {},
    searchDebounceMs: 500,
    searchParamName: "sectorTaskSearch",
  });

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "sector-detail-tasks-visible-columns",
    SECTOR_DETAIL_TASK_VISIBLE_COLUMNS
  );

  // Get all columns for visibility manager
  const allColumns = useMemo(() => createTaskHistoryColumns(), []);

  // Handle table data changes
  const handleTableDataChange = useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Filter to only show tasks from this sector with search
  // useTableFilters provides searchingFor which is automatically included in the query
  const filters = useMemo(() => {
    return {
      where: {
        sectorId: sector.id,
      },
      status: [TASK_STATUS.COMPLETED],
      searchingFor: searchingFor || undefined, // API expects 'searchingFor' parameter
    };
  }, [sector.id, searchingFor]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Tarefas do Setor
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`${routes.production.history.root}?sectorId=${sector.id}`)}
          >
            Ver todas as tarefas
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-0">
        {/* Search and Column Visibility Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={(value) => setSearch(value)}
            placeholder="Buscar por nome, cliente, número de série..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Tasks Table - Remove bottom padding to prevent header overlap */}
        <div className="pb-6">
          <CustomerTasksTable
            visibleColumns={visibleColumns}
            filters={filters}
            navigationRoute="history"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
